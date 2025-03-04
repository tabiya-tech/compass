import asyncio
import csv
import os
import traceback
import json
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

# Access the environment variables
mongo_uri = os.getenv("FEEDBACK_MONGO_URI")
database_name = os.getenv("FEEDBACK_DATABASE_NAME")


async def export_feedback_to_csv():
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(mongo_uri,
                                    tlsAllowInvalidCertificates=True)
        db = client.get_database(database_name)
        collection = db["user_feedback"]

        # Print a sample document to understand the structure
        sample = await collection.find_one()
        if sample:
            print("Sample document structure:")
            print(json.dumps(sample, indent=2, default=str))

        # CSV file headers
        headers = [
            "FeedbackID",
            "UserID",
            "SessionID",
            "QuestionID",
            "QuestionText",
            "QuestionDescription",
            "QuestionAnswered",
            "RatingNumeric",
            "RatingBoolean",
            "SelectedOptions",
            "UserComment",
            "FrontendVersion",
            "BackendVersion",
            "FeedbackTime",
        ]

        # Create directory if it doesn't exist
        directory = "feedback-reports"
        os.makedirs(directory, exist_ok=True)

        # Generate timestamped filename
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"{directory}/feedback_export_{timestamp}.csv"

        # Open CSV file for writing
        file = open(filename, mode="w", newline="", encoding="utf-8")
        writer = csv.writer(file)
        writer.writerow(headers)

        # Retrieve feedback data from MongoDB
        feedback_data = collection.find()

        # Write feedback data to CSV file
        async for feedback in feedback_data:
            feedback_id = str(feedback["_id"])
            user_id = feedback["user_id"]
            session_id = feedback["session_id"]
            frontend_version = feedback["version"]["frontend"]
            backend_version = feedback["version"]["backend"]
            feedback_time = feedback.get("feedback_time", datetime.now().isoformat())  # Default to current time if not present

            # Handle both feedback and feedback_items fields
            feedback_items = feedback.get("feedback", feedback.get("feedback_items", []))
            for item in feedback_items:
                question_id = item["question_id"]
                question_text = item["question_text"]
                answer = item["answer"]
                rating_numeric = answer.get("rating_numeric")
                rating_boolean = answer.get("rating_boolean")
                
                # Format selected_options as key-value pairs
                selected_options = answer.get("selected_options")
                if selected_options is None:
                    selected_options_str = ""
                elif isinstance(selected_options, dict):
                    # Convert dict to string of key-value pairs
                    selected_options_str = "; ".join(f"{k}: {v}" for k, v in selected_options.items())
                elif isinstance(selected_options, list):
                    # Handle legacy list format
                    selected_options_str = "; ".join(selected_options)
                else:
                    selected_options_str = ""
                
                comment = answer.get("comment", "")
                description = item.get("description", "")

                writer.writerow([
                    feedback_id,
                    user_id,
                    session_id,
                    question_id,
                    question_text,
                    description,
                    rating_numeric,
                    rating_boolean,
                    selected_options_str,
                    comment,
                    frontend_version,
                    backend_version,
                    feedback_time,
                ])

        file.close()
        print(f"Feedback data has been exported to file://{os.getcwd()}/{filename}")

    except Exception as e:
        print(f"An error occurred: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(export_feedback_to_csv())
