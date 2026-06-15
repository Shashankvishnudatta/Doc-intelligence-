import shutil
import sqlite3
from pathlib import Path


TARGET_NAME_PART = "BFAI_AI_Engineer_Assessment"


def quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def resolve_path(path_value: str | None) -> Path | None:
    if not path_value:
        return None

    path = Path(path_value)

    if not path.is_absolute():
        path = Path.cwd() / path

    return path


def find_database() -> Path:
    candidates = [
        Path("data/sqlite/app.db"),
        Path("data/app.db"),
        Path("app.db"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    db_files = list(Path("data").rglob("*.db"))

    if db_files:
        return db_files[0]

    raise FileNotFoundError("Could not find SQLite database under backend/data.")


def get_tables(cursor: sqlite3.Cursor) -> list[str]:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in cursor.fetchall()]


def get_columns(cursor: sqlite3.Cursor, table_name: str) -> list[str]:
    cursor.execute(f"PRAGMA table_info({quote_identifier(table_name)})")
    return [row[1] for row in cursor.fetchall()]


def main():
    db_path = find_database()
    print(f"Using database: {db_path}")

    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()

    tables = get_tables(cursor)

    if "documents" not in tables:
        raise RuntimeError("Could not find documents table.")

    document_columns = get_columns(cursor, "documents")

    if "id" not in document_columns:
        raise RuntimeError("documents table has no id column.")

    filename_column = None

    for possible_column in ["original_filename", "filename", "file_name", "name"]:
        if possible_column in document_columns:
            filename_column = possible_column
            break

    if filename_column is None:
        raise RuntimeError("Could not find filename column in documents table.")

    selectable_columns = ["id", filename_column]

    if "file_path" in document_columns:
        selectable_columns.append("file_path")

    select_sql = (
        f"SELECT {', '.join(quote_identifier(column) for column in selectable_columns)} "
        f"FROM documents "
        f"WHERE {quote_identifier(filename_column)} LIKE ?"
    )

    cursor.execute(select_sql, (f"%{TARGET_NAME_PART}%",))
    rows = cursor.fetchall()

    if not rows:
        print("No matching failed BFAI assessment document found.")
        connection.close()
        return

    print(f"Found {len(rows)} matching document(s).")

    for row in rows:
        row_data = dict(zip(selectable_columns, row))

        document_id = row_data["id"]
        filename = row_data[filename_column]
        file_path = row_data.get("file_path")

        print(f"\nDeleting document: {filename}")
        print(f"Document ID: {document_id}")

        paths_to_delete: set[Path] = set()
        directories_to_delete: set[Path] = set()

        original_file = resolve_path(file_path)

        if original_file:
            paths_to_delete.add(original_file)

        # Collect page image paths from any table that has document_id + image_path.
        for table in tables:
            columns = get_columns(cursor, table)

            if "document_id" in columns and "image_path" in columns:
                cursor.execute(
                    f"SELECT image_path FROM {quote_identifier(table)} WHERE document_id = ?",
                    (document_id,),
                )

                for image_row in cursor.fetchall():
                    image_path = resolve_path(image_row[0])

                    if image_path:
                        paths_to_delete.add(image_path)

                        # Usually data/pages/<document_id>/page_001.png
                        if image_path.parent.name == document_id or document_id in str(image_path.parent):
                            directories_to_delete.add(image_path.parent)

        # Delete child rows from every table with document_id.
        for table in tables:
            if table == "documents":
                continue

            columns = get_columns(cursor, table)

            if "document_id" in columns:
                cursor.execute(
                    f"DELETE FROM {quote_identifier(table)} WHERE document_id = ?",
                    (document_id,),
                )

                print(f"Deleted related rows from table: {table}")

        # Delete main document row.
        cursor.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        print("Deleted document row from documents table.")

        # Try to delete vectors if vector service is healthy.
        try:
            from app.services.vector_service import delete_document_vectors

            delete_document_vectors(document_id)
            print("Deleted vector entries from Chroma if any existed.")
        except Exception as exc:
            print(f"Skipped Chroma vector cleanup because vector service failed: {exc}")

        # Delete physical files.
        for path in paths_to_delete:
            try:
                if path.exists() and path.is_file():
                    path.unlink()
                    print(f"Deleted file: {path}")
            except Exception as exc:
                print(f"Could not delete file {path}: {exc}")

        for directory in directories_to_delete:
            try:
                if directory.exists() and directory.is_dir():
                    shutil.rmtree(directory, ignore_errors=True)
                    print(f"Deleted page image directory: {directory}")
            except Exception as exc:
                print(f"Could not delete directory {directory}: {exc}")

    connection.commit()
    connection.close()

    print("\nCleanup complete.")


if __name__ == "__main__":
    main()