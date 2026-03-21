from app.config import load_settings
from app.db.repo import Repository


def main() -> None:
    settings = load_settings()
    repo = Repository(settings.db_path)
    repo.seed_demo_data(force=True)
    print("Mock scenarios seeded successfully.")
    print(f"Database path: {settings.db_path}")


if __name__ == "__main__":
    main()
