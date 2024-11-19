import asyncio
import json
import logging

from typing import Any, Dict
from pathlib import Path
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.feedback.model import FeedbackRecord, Version, FeedbackItem
from app.users.feedback.types import CreateFeedbackRequest
from app.users.feedback.repository import UserFeedbackRepository
from app.users.auth import UserInfo
from app.users.repositories import UserPreferenceRepository
from app.constants.errors import ErrorService
from app.version.utils import load_version_info

logger = logging.getLogger(__name__)

# Cache for questions data
questions_cache: Dict[str, Any] = {}


async def load_questions() -> Dict[str, Any]:
    global questions_cache
    if not questions_cache:
        questions_file = Path(__file__).parent / "questions-en.json"
        try:
            questions_data = await asyncio.to_thread(questions_file.read_text)
            questions_cache = json.loads(questions_data)
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="Questions file not found")
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=500, detail="Failed to load questions data")

    return questions_cache


class UserFeedbackService:
    """
    The UserFeedbackService class provides the business logic for the user feedback routes
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.user_feedback_repository = UserFeedbackRepository(db)
        self.user_preference_repository = UserPreferenceRepository(db)

    async def create_user_feedback(self, body: CreateFeedbackRequest, user_info: UserInfo) -> FeedbackRecord:
        try:
            if not user_info or user_info.user_id != body.user_id:
                raise HTTPException(status_code=403, detail="forbidden")

            current_user_preferences = await self.user_preference_repository.get_user_preference_by_user_id(
                user_info.user_id)
            if current_user_preferences is None or body.session_id not in current_user_preferences.sessions:
                raise HTTPException(status_code=403, detail="User is not allowed to provide feedback for this session")

            # Check if feedback for the given session_id already exists
            existing_feedback = await self.user_feedback_repository.get_feedback_by_session_id(body.session_id)
            if existing_feedback:
                raise HTTPException(status_code=409, detail=f"Feedback for session_id {body.session_id} already exists")

            questions_data = await load_questions()
            version_data = await load_version_info()
            backend_version = f"{version_data['branch']}-{version_data['buildNumber']}"

            # Validate the question IDs and selected options in the body
            for item in body.feedback:
                question_id = item.question_id
                if question_id not in questions_data:
                    raise HTTPException(status_code=400, detail=f"Invalid question ID: {question_id}")

                if item.answer.selected_options:
                    valid_options = questions_data[question_id].get("options", [])
                    for option in item.answer.selected_options:
                        if option not in valid_options:
                            raise HTTPException(status_code=400,
                                                detail=f"Invalid option '{option}' for question ID: {question_id}")

            feedback_data = FeedbackRecord(
                user_id=body.user_id,
                session_id=body.session_id,
                version=Version(
                    frontend=body.version.frontend,
                    backend=backend_version
                ),
                feedback=[
                    FeedbackItem(
                        question_id=feedback.question_id,
                        question_text=questions_data[feedback.question_id]["question_text"],
                        answer=feedback.answer,
                        description=questions_data[feedback.question_id]["description"]
                    )
                    for feedback in body.feedback
                ]
            )

            await self.user_feedback_repository.insert_feedback(feedback_data)
            return feedback_data

        except Exception as e:
            ErrorService.handle(__name__, e)

    async def get_user_feedback(self, user_id: str) -> list[int]:
        return await self.user_feedback_repository.get_feedback_session_ids(user_id)
