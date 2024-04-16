# Evaluation Tests

Tests used for evaluating the correctness and performance of the
compass app and individual agents.

## Marking a test as `evaluation_test`
The evaluation tests are very slow and most of them should not be run in the CI/CD. To exclude them from the CI/CD pipeline,
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
The tests use the `.env` file for credentials, so you need to run it from the same directory as where that file is located.

The logs from the tests is shown in command line if the test failed. The conversation record is additionally saved in `backend/evaluation_tests/test_output/` directory. 

If you would like to see the progress of the conversation and the evaluation logs you can add `-s` parameter to the command, i.e. run: 
```bash
pytest evaluation_tests -s
```

> **Note**: At the moment the test is set to stop after 5 iterations. You can locally change that number in the file. Setting it from command line is work in progress.


## Troubleshooting
If when you run it python complains about an unknown parameter, re-install poetry components using:

```bash
poetry env remove --all
poetry install
```
