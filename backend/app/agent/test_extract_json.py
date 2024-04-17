import unittest

from pydantic import BaseModel

from app.agent.extract_json import extract_json, ValidationError, InvalidJSON, NoJSONFound


# GIVEN a model class
class GivenExampleModel(BaseModel):
    """
    A simple model for testing purposes
    """
    text: str
    boolean: bool
    numeral: int


class TestExtractJson(unittest.TestCase):
    """
    Test the extract_json function
    """

    def test_valid_json_block(self):
        """Should return and instance of the model from a valid JSON block"""
        # GIVEN a model class GivenExampleModel
        # AND a markdown string with a valid JSON block that conforms to the model
        given_markdown_with_valid_json = """
        Here is a JSON block:
        ```json
        {
            "text": "Hello, world!",
            "boolean": true,
            "numeral": 123
        }
        ```
        """

        # WHEN extracting the JSON
        result: GivenExampleModel = extract_json(given_markdown_with_valid_json, GivenExampleModel)

        # THEN the result should be an instance of the model
        self.assertIsInstance(result, GivenExampleModel)
        self.assertEqual(result.text, "Hello, world!")
        self.assertTrue(result.boolean)
        self.assertEqual(result.numeral, 123)

    def test_valid_json(self):
        """Should return and instance of the model from a valid JSON block"""
        # GIVEN a model class GivenExampleModel
        # AND a string with a valid JSON that conforms to the model
        given_text_with_valid_json = """
        Here is a JSON:
        {
            "text": "Hello, world!",
            "boolean": false,
            "numeral": 123
        }
        """

        # WHEN extracting the JSON
        result: GivenExampleModel = extract_json(given_text_with_valid_json, GivenExampleModel)

        # THEN the result should be an instance of the model
        self.assertIsInstance(result, GivenExampleModel)
        self.assertEqual(result.text, "Hello, world!")
        self.assertFalse(result.boolean)
        self.assertEqual(result.numeral, 123)

    def test_repair_json(self):
        """Should return and instance of the model if the JSON in the text can be repaired"""
        # GIVEN a model class GivenExampleModel
        # AND a string that contains an incomplete json
        given_text_with_incomplete_json = """
            {'text': "\nSpecial chars" 
            'boolean': "True",
            'numeral': 123}
            """

        # WHEN extracting the JSON
        result: GivenExampleModel = extract_json(given_text_with_incomplete_json, GivenExampleModel)

        # THEN an InvalidJSON exception should be raised
        self.assertIsInstance(result, GivenExampleModel)
        self.assertEqual(result.text, "\nSpecial chars")
        self.assertTrue(result.boolean)
        self.assertEqual(result.numeral, 123)


    def test_non_conforming_json(self):
        """Should raise ValidationError if there is valid JSON block that DOES NOT conform to the model"""
        # GIVEN a model class GivenExampleModel
        # AND a markdown string with a valid JSON  that DOES NOT conform to the model
        given_markdown_with_non_conforming_json = """
        Here is a JSON:
        {
            "message": "Hello, world!",
            "finished": 123
        }
        """

        # THEN an ValidationError exception should be raised
        with self.assertRaises(ValidationError):
            # WHEN extracting the JSON
            extract_json(given_markdown_with_non_conforming_json, GivenExampleModel)

    def test_no_json(self):
        """Should raise NoJSONFound if there is no JSON in the text"""
        # GIVEN a model class GivenExampleModel
        # AND a string that does not contain any json
        given_text_without_json = "Some random text with no JSON."

        # THEN an NoJSONFound exception should be raised
        with self.assertRaises(NoJSONFound):
            # WHEN extracting the JSON
            extract_json(given_text_without_json, GivenExampleModel)

    def test_irreparable_json(self):
        """Should raise InvalidJSON if there is irreparable JSON in the text"""
        # GIVEN a model class GivenExampleModel
        # AND a string that contains an incomplete json
        given_text_with_incomplete_json = """
        {"message": "Incomplete,}
        """

        # THEN an InvalidJSON exception should be raised
        with self.assertRaises(InvalidJSON):
            # WHEN extracting the JSON
            extract_json(given_text_with_incomplete_json, GivenExampleModel)


if __name__ == '__main__':
    unittest.main()
