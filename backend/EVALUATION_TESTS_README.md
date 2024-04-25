# Evaluation Tests

Tests used for evaluating the correctness and performance of the
compass app and individual agents.

## Marking a test as `evaluation_test`

The evaluation tests are very slow and most of them should not be run in the CI/CD. To exclude them from the CI/CD
pipeline,
mark the test as `evaluation_test` in the test function definition.

```python
@pytest.mark.asyncio
@pytest.mark.evaluation_test
def test_foo_evaluation():
    ...
```

## Running the tests

To run the tests navigate to the `backend/` directory and run:

```bash
pytest evaluation_tests
```

The tests use the `.env` file for credentials, so you need to run it from the same directory as where that file is
located.

The logs from the tests is shown in command line if the test failed. The conversation record is additionally saved
in `backend/evaluation_tests/test_output/` directory.

Optional useful parameters:

- `-s` allows you to see the log output even for tests that pass
- `--max_iterations <number>` allows you to set the number of messages the chatbot is allowed to make.
- `--test_cases_to_run` allows you to set specific test cases to be run. This should mostly be used for local
  development. Takes a comma separated list. The names of the test cases can be found in the conversation_test.py file.

An example run, to run only the kenya_student_e2e test case with 15 max iterations and showing all outputs in command line:
```bash
pytest -s --max_iterations 15 evaluation_tests/ --test_cases_to_run kenya_student_e2e
```

## Troubleshooting

If when you run it python complains about an unknown parameter, re-install poetry components using:

```bash
poetry env remove --all
poetry install
```
