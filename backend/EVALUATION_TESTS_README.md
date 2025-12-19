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
async def test_foo_evaluation():
    ...
```

### Repeating tests
The evaluation tests should be run multiple times as the results can vary a lot due to the LLM nature of the agents. To repeat a test, use the
`@pytest.mark.repeat` annotation from the `pytest-repeat` plugin.

For example, to run a test 10 times:

```python
@pytest.mark.asyncio
@pytest.mark.repeat(5) # Repeat the test 5 times
async def test_foo_evaluation():
    ...
```

### Test Logging and Aggregation

All tests annotated with `@pytest.mark.evaluation_test` capture and aggregate their results in the `test_output/` directory, generating both JSON (`test_results.json`) and CSV (`test_results.csv`) files.

To aggregate and summarize this data across multiple test runs, you can execute:

```
python evaluation_metrics.py
```

This command creates a comprehensive summary (`test_summary.csv`) that aggregates results, grouped by both test name and label. It supports both parameterized and non-parameterized tests.

Run `python evaluation_tests/evalution_metrics.py --help` to see the available options.


The `evaluation_test` annotation accepts a version label, for example:

```python
@pytest.mark.evaluation_test("foo")
def some_test_evaluation():
    ...
```

This label is used to tag the test results, making it easier to track performance across different code versions.

**Limitations:**

* **Label Management:** The version label should not be checked into the repository, so you need to remember to update it before each run.
* **Pass/Fail Granularity:** The evaluation tests only capture a basic pass/fail result, which means they aren't detailed enough to measure accuracy, precision, or other nuanced metrics. However, this approach is a straightforward and practical way to debug and test LLM-based agents.


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
  development. Takes a comma separated list. The names of the test cases can be found in the conversation_test.py file. If used together
  with `--test_cases_to_run`, the test cases to exclude will be excluded from the list of test cases to run.

An example run, to run only the kenya_student_e2e test case with 15 max iterations and showing all outputs in command line:

```bash
pytest -s --max_iterations 15 evaluation_tests/ --test_cases_to_run kenya_student_e2e
```

## Using the `skip_force` property to control test execution

You can choose to skip or force running a specific test using the `skip_force` property of a test case.

```python


test_cases = [
    EvaluationTestCase(
        # Setting this to force will run only this test
        skip_force="force", # or "skip" to skip the test     
        name='foo_test',
        simulated_user_prompt='foo',
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    # More text cases
]

```

## Using Matchers for Data Validation

Matchers provide a flexible way to validate extracted data in tests, especially when dealing with LLM outputs that may vary in exact wording. Instead of exact string matching, matchers allow you to specify patterns and conditions.

### Available Matchers

- **`ContainsString(string, case_sensitive=False)`** - Checks if a string contains the specified substring
- **`AnyOf(*options)`** - Matches if the value matches any of the provided options (can include other matchers, strings, or regex patterns)
- **`DictContaining(expected_dict)`** - Matches if a dictionary contains all expected keys with matching values
- **`AnyValue()`** - Matches any value (useful for optional fields)

### Example Usage

```python
from evaluation_tests.matcher import ContainsString, AnyOf, DictContaining

expected_experience_data = [{
    "location": AnyOf(ContainsString("Tokyo"), ContainsString("Tokio")),
    "company": ContainsString("Shoe Soles"),
    "timeline": {
        "start": ContainsString("2023"),
        "end": AnyOf(ContainsString("present"), "")
    },
    "experience_title": ContainsString("Salesperson")
}]
```

Matchers can be nested and combined:

```python
# Match any of multiple possible values
"location": AnyOf("Tokyo", "Tokio", ContainsString("Japan"))

# Nested dictionary matching
"timeline": DictContaining({
    "start": ContainsString("2023"),
    "end": AnyOf("present", "Present", "")
})

# Case-insensitive matching
"company": ContainsString("shoe soles", case_sensitive=False)
```

### When to Use Matchers vs LLM Evaluators

- **Use Matchers** when you need deterministic, fast validation of structured data (e.g., extracted experience fields, dates, locations)
- **Use LLM Evaluators** when you need semantic understanding or evaluation of conversational quality (e.g., conciseness, relevance, language consistency)

## Working with Locales

Evaluation tests support multiple locales to test multilingual behavior. Each test case can specify a `locale` property to set the language context.

### Supported Locales

- `Locale.EN_US` - English (US)
- `Locale.EN_GB` - English (UK)
- `Locale.ES_AR` - Español (Argentina)
- `Locale.ES_ES` - Español (España)

### Setting Locale in Test Cases

```python
from app.i18n.types import Locale

test_cases = [
    EvaluationTestCase(
        name='spanish_test',
        locale=Locale.ES_AR,  # Set the locale for this test
        simulated_user_prompt='...',
        evaluations=[...]
    ),
]
```

### Locale in Test Execution

When a test case specifies a locale, the i18n manager is automatically configured:

```python
# In your test function
async def test_my_agent(test_case: EvaluationTestCase):
    get_i18n_manager().set_locale(test_case.locale)
    # ... rest of test
```

The locale affects:
- Agent responses (should be in the specified language)
- Translation behavior
- Language-specific evaluations (e.g., `SINGLE_LANGUAGE` evaluation type)

### Test ID Generation

Test cases automatically generate a `test_id` property that combines the test name and locale:

```python
test_case.test_id  # Returns: "my_test-ES_AR"
```

This is used for pytest parametrization to distinguish the same test run in different locales.

## Translation Tool

The `TranslationTool` is a utility for translating text between languages using LLM-based translation. It's primarily used in evaluation tests to support multilingual testing scenarios.

### When to Use

- **Embedding Evaluation**: Translating English test queries to evaluate embeddings in other languages
- **Cross-lingual Testing**: Verifying that translations maintain semantic meaning
- **Multilingual Test Data**: Generating test data in different languages

**Note**: The TranslationTool is NOT for runtime translation of UI strings. Use the i18n system (`t()` function) for that purpose.

### Basic Usage

```python
from common_libs.agent.translation_tool import TranslationTool
from app.i18n.types import Locale

# Initialize with target locale
tool = TranslationTool(target_locale=Locale.ES_AR)

# Translate text
translated_text = await tool.translate("Hello, how are you?")
# Returns: "Hola, ¿cómo estás?"

# Compare semantic equivalence
result = await tool.compare("Hello", "Hola")
# Returns: "SIMILAR" or "DIFFERENT"
```

### Limitations

- **LLM-based**: Makes API calls to Gemini, so it's slow and has costs
- **Non-deterministic**: Translations may vary between calls
- **No caching**: Each call translates fresh (no memoization)
- **Test-only**: Designed for evaluation scenarios, not production use

### Example: Embedding Evaluation

```python
translation_tool = TranslationTool(Locale.ES_AR)
for query in english_queries:
    translated_query = await translation_tool.translate(query)
    results = await search_service.search(query=translated_query, k=10)
    # Evaluate Spanish embeddings with translated queries
```

## Test Output Interpretation

Evaluation tests generate detailed output files that help you understand test results and track performance over time.

### Output Files

All evaluation tests generate output in `backend/test_output/`:

- **`test_results.json`** - Detailed JSON log of all test runs
- **`test_results.csv`** - CSV format for easy analysis
- **`test_summary.csv`** - Aggregated summary (generated by `evalution_metrics.py`)
- **Per-test directories** - Individual test outputs with conversation records

### Understanding Test Results

#### CSV Structure

The `test_results.csv` contains:
- `test_name` - Full test name including parameters
- `label` - Version label from `@pytest.mark.evaluation_test("label")`
- `outcome` - "passed" or "failed"
- `duration` - Test execution time in seconds
- `timestamp` - When the test ran

#### Summary Metrics

After running `python evaluation_tests/evalution_metrics.py`, `test_summary.csv` provides:

- **`duration_mean`** - Average test duration
- **`duration_std`** - Standard deviation of duration
- **`duration_count`** - Number of test runs
- **`outcome_distribution`** - Dictionary of pass/fail counts (e.g., `{"passed": 8, "failed": 2}`)
- **`pass_percentage`** - Percentage of runs that passed

#### Interpreting Scores

Evaluation results use a **0-100 scale**:
- **100** - Perfect match/quality
- **70-99** - Good quality with minor issues
- **50-69** - Acceptable but needs improvement
- **0-49** - Poor quality, significant issues

Example evaluation assertion:
```python
evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
# This expects the conciseness score to be at least 70
```

### Reading Test Outputs

#### Individual Test Outputs

Each test creates a directory in `test_output/` with:
- Conversation records (JSON/Markdown)
- Extracted data
- Evaluation results
- Failure messages (if any)

#### Identifying Regressions

1. **Compare pass percentages** across different labels:
   ```bash
   # Run with different labels
   pytest --eval-label="before-change" ...
   pytest --eval-label="after-change" ...
   
   # Compare in test_summary.csv
   ```

2. **Check outcome distributions**: A test going from `{"passed": 10}` to `{"passed": 7, "failed": 3}` indicates a regression

3. **Monitor duration**: Significant increases in `duration_mean` may indicate performance issues

#### Common Patterns

- **Flaky tests**: High `duration_std` and mixed `outcome_distribution` (e.g., `{"passed": 6, "failed": 4}`)
- **Consistent failures**: `pass_percentage` near 0% indicates a broken test
- **Performance degradation**: `duration_mean` increasing over time

### Best Practices

- **Use version labels** to track changes: `@pytest.mark.evaluation_test("v1.2.3")`
- **Run tests multiple times** with `@pytest.mark.repeat(3)` to catch flakiness
- **Review individual outputs** when tests fail to understand root causes
- **Compare summaries** before/after changes to detect regressions

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
      to make sure it is saved even if the test fails. You can look at the test `test_qna_agent_responds_to_multiple_questions_in_a_row` in `qna_agent_test.py`
      for an example.
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
