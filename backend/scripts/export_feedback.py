import asyncio
import csv
import os
import traceback
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
            feedback_time = feedback["feedback_time"]

            for item in feedback["feedback"]:
                question_id = item["question_id"]
                question_text = item["question_text"]
                answer = item["answer"]
                is_answered = item["is_answered"]
                rating_numeric = answer["rating_numeric"]
                rating_boolean = answer["rating_boolean"]
                selected_options = ",".join(answer["selected_options"]) if isinstance(answer["selected_options"], list) else ""
                comment = answer["comment"]
                description = item["description"]

                writer.writerow([
                    feedback_id,
                    user_id,
                    session_id,
                    question_id,
                    question_text,
                    description,
                    is_answered,
                    rating_numeric,
                    rating_boolean,
                    selected_options,
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
