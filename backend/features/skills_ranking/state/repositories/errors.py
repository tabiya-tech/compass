class RegistrationDataNotFoundError(Exception):
    """
    Raised when the registration data is not found for some user_id.
    On the Repository layer.
    """

    def __init__(self, user_id: str):
        self.message = f"Registration data not found for user ID: {user_id}"
        super().__init__(self.message)
