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
in `backend/test_output/` directory.

Optional useful parameters:

- `-s` allows you to see the log output even for tests that pass
- `--max_iterations <number>` allows you to set the number of messages the chatbot is allowed to make.
- `--test_cases_to_run` run only the specified test cases. This should mostly be used for local
  development. Takes a comma separated list. The names of the test cases can be found there were they are defined. 
- `--test_cases_to_exclude` exclude specific test cases from running. This should mostly be used for local
  development. Takes a comma separated list. The names of the test cases can be found in the conversation_test.py file. If used together with `--test_cases_to_run`, the test cases to exclude will be excluded from the list of test cases to run.

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

## Writing tests

### Adding a new Agent test best practices

Unlike normal unit tests, evaluation tests test the accuracy of the LLM prompts and behaviour of the agents. On top of
evaluation tests, if the class you are working with has a lot of logic outside of LLM prompts, you should also write
tests that mock the LLM prompts and test the logic of the class.

- Make the tests as small as possible, it should test a single feature or a single agent.
- Mock or stub as many dependencies as you can and focus only on things that are relevant to the agent.
  - Use `FakeConversationContext` to create a conversation with the agent. This will allow you to test the agent in a
    controlled environment. If possible, write a static history of the conversation instead of generating it.
  - Mock any database calls or calls to other agents/classes in the system.
- Evaluate the agent's output by checking the response from the agent and not the conversation history. Since those are
  all LLM responses, you can use an LLM to evaluate the response. It is best to create your own prompt and check exactly
  the specific thing that should happen. You can look at the `qna_agent_test.py` for an example of how to do this.
- You can conduct a fake conversation using the `generate_conversation.generate` function script. Here as well evaluate
  the conversation with as specific criteria as possible.
  - It is advisable to save the content of the conversation. Use a fixture or a finally block to save the conversation
    to make sure it is saved even if the test fails. You can look at the test `test_qna_agent_responds_to_multiple_questions_in_a_row` in `qna_agent_test.py` for an example.
- Greater quantity but smaller tests is better than one big test.
- There is a set of fixtures in `conftest.py` that can be re-used in all tests. In particular:
  - Use the `common_folder_path` whenever saving a file.
  - Use the `fake_conversation_context` to get the `FakeConversationContext` to be used in tests.

### E2E tests

On top of the tests for individual agents, there is an e2e test. This is designed to evaluate the application e2e, and
does not mock any components. There are a few test cases that are run with very basic high-level evaluation.

If you are adding a new feature:

- Make sure that it is covered by existing test cases and add a new test case if not. The test cases are
  in `evaluation_tests/core_e2e_tests_cases.py` file.
- Add any new evaluation to test the correctness, if possible.
- Keep it high-level and do not depend on any implementation detail.
