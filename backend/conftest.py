def pytest_addoption(parser):
    parser.addoption("--max_iterations", action="store", default="5")


def pytest_generate_tests(metafunc):
    option_value = metafunc.config.option.max_iterations
    if 'max_iterations' in metafunc.fixturenames and option_value is not None:
        metafunc.parametrize("max_iterations", [int(option_value)])
