import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------- In-Memory Tenant Cache ----------
// Avoids hitting the DB on every single request just to resolve a domain.
const tenantCache = new Map();

/**
 * Lookup a tenant by domain (subdomain identifier).
 * Results are cached in memory after the first lookup.
 *
 * @param {import('pg').Pool} pool - The global database pool
 * @param {string} domain - The tenant domain/subdomain identifier (e.g., 'iiitdmj')
 * @returns {Promise<{ schema_name: string, institute_name: string }>}
 */
export async function lookupTenant(pool, domain) {
    // Check cache first
    if (tenantCache.has(domain)) {
        return tenantCache.get(domain);
    }

    const { rows } = await pool.query(
        'SELECT schema_name, institute_name FROM tenants WHERE domain = $1 AND is_active = TRUE',
        [domain]
    );

    if (rows.length === 0) {
        throw new Error(`Unregistered Institute: ${domain}`);
    }

    const tenant = {
        schema_name: rows[0].schema_name,
        institute_name: rows[0].institute_name,
    };

    // Cache the result
    tenantCache.set(domain, tenant);
    return tenant;
}

/**
 * Invalidate a cached tenant entry. 
 * Call this after provisioning or updating a tenant.
 *
 * @param {string} domain
 */
export function invalidateCache(domain) {
    tenantCache.delete(domain);
}

/**
 * Validate that a schema name is safe to use in SQL (alphanumeric + underscores only).
 * Prevents SQL injection through schema names.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isValidSchemaName(name) {
    return /^[a-z][a-z0-9_]{0,48}$/.test(name);
}

/**
 * Provision a new tenant: create schema, create tables, register in master catalog.
 * Wrapped in a transaction — if any step fails, everything rolls back.
 *
 * @param {import('pg').Pool} pool - The global database pool
 * @param {string} schemaName - The PostgreSQL schema name (e.g., 'iiitdmj')
 * @param {string} instituteName - Human-readable name (e.g., 'IIITDM Jabalpur')
 * @param {string} domain - The subdomain identifier (e.g., 'iiitdmj')
 */
export async function provisionTenant(pool, schemaName, instituteName, domain) {
    // Validate schema name to prevent injection
    if (!isValidSchemaName(schemaName)) {
        throw new Error(
            'Invalid schema name. Must start with a letter, contain only lowercase alphanumeric characters and underscores, max 49 chars.'
        );
    }

    // Read the tenant table-creation SQL from schema.sql
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf-8');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create the schema
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

        // 2. Set search_path to the new schema so tables are created inside it
        await client.query(`SET search_path TO "${schemaName}"`);

        // 3. Execute the tenant tables SQL
        await client.query(schemaSql);

        // 4. Reset search_path
        await client.query('SET search_path TO public');

        // 5. Register the tenant in the master catalog
        await client.query(
            'INSERT INTO tenants (institute_name, domain, schema_name) VALUES ($1, $2, $3)',
            [instituteName, domain, schemaName]
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        // Reset search_path even on failure
        try { await client.query('SET search_path TO public'); } catch (_) { /* ignore */ }
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Run a migration SQL statement across ALL active tenant schemas.
 * Useful for schema evolution (e.g., ALTER TABLE Student ADD COLUMN phone VARCHAR(15)).
 *
 * @param {import('pg').Pool} pool
 * @param {string} migrationSql - The SQL to execute in each tenant schema
 * @returns {Promise<{ success: string[], failed: { domain: string, error: string }[] }>}
 */
export async function runMigration(pool, migrationSql) {
    const { rows: tenants } = await pool.query(
        'SELECT domain, schema_name FROM tenants WHERE is_active = TRUE'
    );

    const results = { success: [], failed: [] };

    for (const tenant of tenants) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SET search_path TO "${tenant.schema_name}"`);
            await client.query(migrationSql);
            await client.query('SET search_path TO public');
            await client.query('COMMIT');
            results.success.push(tenant.domain);
        } catch (err) {
            await client.query('ROLLBACK');
            try { await client.query('SET search_path TO public'); } catch (_) { /* ignore */ }
            results.failed.push({ domain: tenant.domain, error: err.message });
        } finally {
            client.release();
        }
    }

    return results;
}
