import logging
import os
import sys
import traceback
import logging.config
import yaml


def _get_main_module_path():
    """
    Returns the directory of the top-level script (typically __main__).
    :return: str - directory path of the main module
    """
    main_module = sys.modules['__main__']
    if hasattr(main_module, '__file__'):
        main_path = os.path.abspath(main_module.__file__)
        main_dir = os.path.dirname(main_path)
        return main_dir
    else:
        # E.g., running in interactive shell or Jupyter Notebook
        return os.getcwd()


def _ensure_log_directory_exists(config):
    try:
        # Iterate over all handlers in the config
        handlers = config.get('handlers', {})
        for handler_name, handler in handlers.items():
            if 'filename' in handler:  # Check if this is a file handler
                log_file_path = handler['filename']
                log_dir = os.path.dirname(log_file_path)

                # Create the directory if it doesn't exist
                if log_dir and not os.path.exists(log_dir):
                    os.makedirs(log_dir, exist_ok=True)
                    print(f"Created log directory for handler '{handler_name}': {log_dir}")
    except OSError as e:
        print(f"Error: Could not create log directory. Details: {e}")
        raise


def _get_configuration_filename(file: str):
    # Check if the given file path is an absolute path
    if os.path.isabs(file):
        return file

    module_path = _get_main_module_path()
    return os.path.join(module_path, file)


def setup_logging_config(cfg_file: str):
    configuration_file = _get_configuration_filename(cfg_file)
    try:
        with (open(configuration_file, 'r', encoding="utf-8") as stream):
            try:
                # Get the module path
                module_path = _get_main_module_path()

                # Read the configuration file,
                # we are changing the config to string first so that we can replace the PROJECT_BASE_PATH with the module path
                # to decide where logs are going to go, as this config is used by many submodules
                config = stream.read()

                # Replace the PROJECT_BASE_PATH with the module path,
                # this project base path is used to know where the logs are going to be placed in a file
                config = config.replace("{PROJECT_BASE_PATH}", module_path)

                # Load the configuration
                cfg = yaml.safe_load(config)

                # Ensure the log directory exists
                _ensure_log_directory_exists(cfg)
                # Configure the logging
                logging.config.dictConfig(cfg)  # just once
            except yaml.YAMLError as exc:
                print(f"An error occurred while parsing the yaml file:{configuration_file}\n", exc, file=sys.stderr)
            except Exception:  # pylint: disable=broad-except
                print("Unexpected error occurred while configuring logging\n", traceback.format_exc(),
                      file=sys.stderr)
    except IOError:
        print(f"An error occurred while opening the yaml file:{configuration_file}", traceback.format_exc(),
              file=sys.stderr)
