from sqlalchemy.orm import Session
from ..models.models import User, UserSettings, Base
from .database import SessionLocal, engine

def init_db():
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")
        
        db = SessionLocal()
        try:
            # Check if default user exists
            user = db.query(User).filter(User.username == "default").first()
            if not user:
                print("Creating default user")
                # Create default user
                user = User(
                    username="default",
                    email="default@cochat.local",
                    hashed_password="",  # No password needed for now
                    is_active=True
                )
                db.add(user)
                db.flush()  # Flush to get the user ID
                
                # Create default user settings
                settings = UserSettings(
                    user=user,
                    theme="dark",
                    default_model="gpt-3.5-turbo",
                    interface_settings={"layout": "grid"}
                )
                db.add(settings)
                
                db.commit()
                print("Default user and settings created successfully")
            else:
                print("Default user already exists")
        except Exception as e:
            print(f"Error initializing database data: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as e:
        print(f"Error creating database tables: {e}")
        raise

if __name__ == "__main__":
    init_db() 