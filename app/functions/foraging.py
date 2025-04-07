import json
import os
from pathlib import Path

import pandas as pd
import streamlit as st
from resources.foraging_resources import default_foraging_types


class Foraging:
    short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Define file paths (use relative paths for better portability)
    data_directory = "app/foraging_data"

    # Create data directory if it doesn't exist
    os.makedirs(data_directory, exist_ok=True)

    foraging_types_path = os.path.join(data_directory, "foraging_types.json")

    # @st.cache_data(show_spinner=False)
    def load_foraging_types(self):
        if os.path.exists(self.foraging_types_path):
            try:
                with Path.open(self.foraging_types_path) as f:
                    return json.load(f)
            except Exception as e:
                st.warning(f"Could not load foraging types: {e}")
                return default_foraging_types
        else:
            return default_foraging_types

    # Save foraging types to JSON file
    def save_foraging_types(self, foraging_types) -> bool:
        try:
            with Path.open(self.foraging_types_path, "w") as f:
                json.dump(foraging_types, f)
            return True
        except Exception as e:
            st.error(f"Error saving foraging types: {e}")
            return False

    # Load foraging data from CSV file
    # @st.cache_data(show_spinner=False)
    def load_foraging_data(self, csv_data_path) -> dict[str, list]:
        if os.path.exists(csv_data_path):
            try:
                df = pd.read_csv(csv_data_path)
                # Convert dataframe to dictionary format for compatibility with existing code
                data_dict = {month: [] for month in self.short_months}

                for _, row in df.iterrows():
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
    def save_foraging_data(self, data_dict, csv_data_path) -> bool:
        # Convert dictionary to dataframe
        rows = []
        for month, items in data_dict.items():
            for item in items:
                rows.append(
                    {
                        "month": month,
                        "type": item["type"],
                        "lat": item["lat"],
                        "lng": item["lng"],
                        "notes": item["notes"],
                        "date": item["date"],
                    }
                )

        df = pd.DataFrame(rows)

        # Make sure the directory exists
        os.makedirs(os.path.dirname(csv_data_path), exist_ok=True)

        # Save to CSV
        try:
            df.to_csv(csv_data_path, index=False)
            return True
        except Exception as e:
            st.error(f"Error saving data: {e}")
            return False
