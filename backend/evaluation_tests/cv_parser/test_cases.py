from pydantic import BaseModel

class CVParserTestCase(BaseModel):
    name: str
    markdown_cv: str
    min_items: int = 1
    must_contain_keywords: list[str] | None = None


simple_single_role = CVParserTestCase(
    name="simple_single_role",
    markdown_cv=(
        "# John Doe\n\n"
        "## Experience\n\n"
        "- Project Manager, University of Oxford (2018 - 2020), Remote.\n\n"
        "## Education\n\n"
        "BSc Computer Science"
    ),
    min_items=1,
    must_contain_keywords=["Project Manager", "Oxford", "2018", "2020"],
)

multi_roles_mixed_paid = CVParserTestCase(
    name="multi_roles_mixed_paid",
    markdown_cv=(
        "# Jane Smith\n\n"
        "## Experience\n\n"
        "- Software Architect, ProUbis GmbH, Berlin (2010 - 2018)\n"
        "- Volunteer Instructor, Community Center, Berlin (2015 - 2017)\n"
        "- Internship, Ubis GmbH, Berlin (1998)\n"
    ),
    min_items=3,
    must_contain_keywords=["Software Architect", "Volunteer", "Internship", "Berlin"],
)

entrepreneurship_case = CVParserTestCase(
    name="entrepreneurship_case",
    markdown_cv=(
        "# Alex Roe\n\n"
        "## Professional Experience\n\n"
        "- Co-founded Acme Inc. (2022 - Present), CEO, Washington, DC, USA\n"
        "- Owner, Dinner For Two, Berlin (2010 - 2020)\n"
    ),
    min_items=2,
    must_contain_keywords=["Co-founded", "CEO", "Dinner For Two", "Berlin"],
)

noisy_markdown = CVParserTestCase(
    name="noisy_markdown",
    markdown_cv=(
        "# CV\n\n"
        "| Role | Company | Years |\n|------|---------|-------|\n| Developer | Freelance | 2020-2022 |\n\n"
        "Responsibilities:\n\n* Built apps\n* Deployed systems\n"
    ),
    min_items=1,
    must_contain_keywords=["Developer", "Freelance"],
)

test_cases: list[CVParserTestCase] = [
    simple_single_role,
    multi_roles_mixed_paid,
    entrepreneurship_case,
    noisy_markdown,
]


