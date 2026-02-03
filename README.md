<h1 align="center">
<img src="https://raw.githubusercontent.com/tabiya-tech/docs/refs/heads/main/.gitbook/assets/compass_logo_web_light.png#gh-dark-mode-only" alt="logo" width=300/>
<img src="https://raw.githubusercontent.com/tabiya-tech/docs/refs/heads/main/.gitbook/assets/compass_logo_web_dark.png#gh-light-mode-only" alt="logo" width=300/>
</h1>

**Compass** is an AI chatbot designed to assist job-seekers in exploring and discovering their skills.

Compass has two objectives: 
- Populate a digital skill wallet that captures the experience of job-seekers, including the
skills inherent in their formal and informal work.
- By doing so, guide job-seekers in exploring and discovering
their skills and interests based on their lived experiences.

## Table of Contents

- **[Backend](backend)**: Explore the Backend directory for detailed insights about the backend project.

- **[Frontend](frontend-new)**: Explore the Frontend directory for detailed insights about the frontend project.

- **[Infrastructure As Code (IaC)](iac)**: Explore the Infrastructure as code(IAC) directory for detailed insights about
  the infrastructure-as-code components.

- **[Sensitive Data Protection](sensitive-data-protection.md)**: Explore the sensitive data protection functionality for detailed insights about how we are safeguarding sensitive personal data.

## Architecture Overview
The images below show a high level overview of the solution architecture of Compass.

![Compass Architecture Overview](https://lucid.app/publicSegments/view/a1c21a2d-162b-4eae-b70a-f57b44181aa1/image.png)

![Compass Cloud Architecture](https://lucid.app/publicSegments/view/fb45c622-0edb-4257-84a3-6fc4996692f3/image.png)

![Compass Backend Architecture](https://lucid.app/publicSegments/view/3e5323ab-786b-4d46-bb73-dd716cdd9ee0/image.png)

![Compass AI Architecture](https://lucid.app/publicSegments/view/db45dc1c-b89e-4ae4-bd32-347092693844/image.png)

## Why Contribute?

- **Make an Impact:** Your contributions will directly improve the user experience and functionality of Compass, helping job-seekers explore and discover their skills more effectively.
- **Help Achieve Our Goals:** By contributing, you are supporting Compass’s mission to populate digital skill wallets and guide job-seekers in understanding their skills and interests based on their lived experiences.

## Ways to Contribute

1. **Reporting Issues:** If you encounter bugs or have suggestions, open an issue on GitHub. Your feedback is valuable.
2. **Code Contributions:** Help enhance the codebase by submitting pull requests.
3. **Write or Improve Tests:** We aim for 100% code coverage. You can help achieve this goal by writing or improving tests.
4. **Documentation:** Improve project documentation by submitting pull requests. Clear documentation is crucial for new contributors.
5. **Add a New Language**: Help make Compass accessible to more users by adding support for a new language. Follow the guidelines in [add-a-new-language.md](./add-a-new-language.md).
6. **Support:** Give the project a star on GitHub—your support encourages us to keep improving!

## Contribution Guidelines

🎉 Thank you for considering contributing to Tabiya Compass! 🎉

### Code Formatting

### Frontend
We follow the **[Prettier](https://prettier.io/)** code formatting guidelines to make sure the code is properly formatted in a uniform way.

You can find the configuration in the **[.prettierrc.json](frontend-new/.prettierrc.json)** file.

> **Note:**  
> For IntelliJ IDEA, if you make changes to the Prettier config, you may need to restart the IDE before formatting code using the IDE’s formatting function.

### Backend
We follow the **[PEP 8 Style Guide](https://peps.python.org/pep-0008/)** to ensure the backend Python code is properly formatted in a consistent way.

We use **pylint** (with `pylint-pydantic`) as our linting tool.

You can find the configuration in the **[.pylintrc](backend/.pylintrc)** file.

> **Note:**  
> For IntelliJ IDEA / PyCharm, if you make changes to the linting configuration, you may need to restart the IDE before formatting or linting code using the IDE’s built-in tools.

### Conventional Commits

Please follow the **[Conventional Commits](https://www.conventionalcommits.org/)** format for commit messages.

### Guidelines for Readable BDD Testing

To contribute to our 100% code coverage goal, refer to our "Guidelines for Readable BDD Testing" in the **[testing-guidelines.md](testing-guidelines.md)**

### Guidelines for Snapshot Testing
To ensure component stability, refer to our "Snapshot Testing Guidelines" in the **[snapshot-testing-guidelines.md](snapshot-testing-guidelines.md)**

## Getting Started

To work with this repository you should have a system with a bash compatible terminal (linux, macOS, cygwin) as most of the scripts are written for bash and will not work on windows cmd or powershell.

1. Fork the repository and clone it to your local environment.

2. Create a new branch for your changes.

3. Set up each individual subproject. e.g. if you are working on `backend/` follow instructions in `backend/README.md`

4. After making your changes, ensure the code is clean, properly formatted and passes all tests.

    You can use the provided script, `run-before-merge.sh`, for assistance. This script performs checking of the code formatting, linting, building, and testing on the subprojects of the repository. To run it, use the following command:
      
    ```bash
    ./run-before-merge.sh
    ```
      
    If you get any errors, fix them before proceeding. A common source of errors is not fully completing step `3` from above.

5. Commit them and push to your fork.

6. Use descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

7. Open a pull request to our main branch.

Happy contributing! 🚀

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

## Funders and Partners
<img src="frontend-new/public/logo_Google.org_Support_FullColor_cmyk%20coated_stacked.png" alt="Google.org Logo" width=200/>

This project is tested with BrowserStack.


