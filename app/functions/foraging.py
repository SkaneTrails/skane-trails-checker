import json
from pathlib import Path
from typing import ClassVar

import pandas as pd
import streamlit as st

from app.resources.foraging_resources import default_foraging_types


class Foraging:
    short_months: ClassVar[list[str]] = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]

    # Define file paths (use relative paths for better portability)
    data_directory: ClassVar[Path] = Path("app/foraging_data")

    # Create data directory if it doesn't exist
    data_directory.mkdir(parents=True, exist_ok=True)

    foraging_types_path: ClassVar[Path] = data_directory / "foraging_types.json"

    # @st.cache_data(show_spinner=False)
    def load_foraging_types(self) -> dict:
        if self.foraging_types_path.exists():
            try:
                with self.foraging_types_path.open() as f:
                    return json.load(f)
            except Exception as e:
                st.warning(f"Could not load foraging types: {e}")
                return default_foraging_types
        else:
            return default_foraging_types

    # Save foraging types to JSON file
    def save_foraging_types(self, foraging_types: dict) -> bool:
        try:
            with self.foraging_types_path.open("w") as f:
                json.dump(foraging_types, f)
            return True
        except Exception as e:
            st.error(f"Error saving foraging types: {e}")
            return False

    # Load foraging data from CSV file
    # @st.cache_data(show_spinner=False)
    def load_foraging_data(self, csv_data_path: Path | str) -> dict[str, list]:
        csv_path = Path(csv_data_path)
        if csv_path.exists():
            try:
                data_frame = pd.read_csv(csv_path)
                # Convert dataframe to dictionary format for compatibility with existing code
                data_dict = {month: [] for month in self.short_months}

                for _, row in data_frame.iterrows():
                    item = {
                        "type": row["type"],
                        "lat": row["lat"],
                        "lng": row["lng"],
                        "notes": row["notes"],
                        "date": row["date"],
                    }
                    data_dict[row["month"]].append(item)

                return data_dict
            except Exception as e:
                st.warning(f"Could not load data: {e}")
                return {month: [] for month in self.short_months}
        else:
            return {month: [] for month in self.short_months}

    # Save foraging data to CSV file
    def save_foraging_data(self, data_dict: dict[str, list], csv_data_path: Path | str) -> bool:
        csv_path = Path(csv_data_path)
        # Convert dictionary to dataframe
        rows = []
        for month, items in data_dict.items():
            rows.extend(
                {
                    "month": month,
                    "type": item["type"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "notes": item["notes"],
                    "date": item["date"],
                }
                for item in items
            )

        data_frame = pd.DataFrame(rows)

        # Make sure the directory exists
        csv_path.parent.mkdir(parents=True, exist_ok=True)

        # Save to CSV
        try:
            data_frame.to_csv(csv_path, index=False)
            return True
        except Exception as e:
            st.error(f"Error saving data: {e}")
            return False
