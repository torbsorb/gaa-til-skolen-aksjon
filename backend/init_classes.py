# Script to initialize the database with classes and groups from class_map.py
from models import Base, SchoolClass, ClassGroup
from database import engine, SessionLocal
from class_map import class_map, competition_map

# Clear and recreate tables
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

group_name_to_obj = {}

# Create groups from competition_map
for group in competition_map:
    for name, class_names in group.items():
        group_obj = ClassGroup(name=name)
        db.add(group_obj)
        group_name_to_obj[name] = group_obj

db.commit()

group_lookup = {}
for group in db.query(ClassGroup).all():
    group_lookup[group.name] = group


# Add classes and assign to groups, and store total_students as an attribute if possible
for class_set in class_map:
    for class_dict in class_set:
        for class_name, total_students in class_dict.items():
            group_name = None
            for group in competition_map:
                for gname, class_names in group.items():
                    if class_name in class_names:
                        group_name = gname
                        break
                if group_name:
                    break
            if group_name is None:
                print(f"Warning: No group found for class {class_name}")
                continue
            # Try to set total_students if SchoolClass supports it
            try:
                school_class = SchoolClass(name=class_name, group_id=group_lookup[group_name].id, total_students=total_students)
            except TypeError:
                school_class = SchoolClass(name=class_name, group_id=group_lookup[group_name].id)
            db.add(school_class)

db.commit()
db.close()
print("Database initialized with classes and groups.")
