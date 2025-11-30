create table Student(Roll_No varchar(20) not null primary key, Name varchar(25) not null, Email varchar(50) not null, Hostel_Name varchar(50));

create table Location (Place_Id varchar(20) not null Primary key, Place_Name varchar(100) not null);

create table Guard (Guard_Id varchar(20) not null Primary Key, Guard_Name varchar(50) not null, 
Place_Id varchar(20), foreign key (Place_Id) references Location(Place_Id));

create table Admin(Admin_Id varchar(20) not null Primary key, Name varchar(50) not null, Department varchar(50));

create table Log(roll_no varchar(20) not null, Guard_Id varchar(20) not null, Place_Id varchar(20) not null, log_type varchar(15) not null, Timestamp timestamp not null,
primary key(roll_no,guard_id,place_id),
foreign key (roll_no) references student(roll_no);

alter table log add foreign key (place_id) references Location(place_id);

alter table log add foreign key (guard_id) references Guard(guard_id);

