from pydantic import BaseModel


class CVParserTestCase(BaseModel):
    name: str
    markdown_cv: str
    # Behavioral expectations: each inner list contains substrings that must all appear in one extracted line (case-insensitive)
    expected_item_keywords: list[list[str]]


simple_single_role_with_headings = CVParserTestCase(
    name="simple_single_role_with_headings",
    markdown_cv=(
        "# John Doe\n\n"
        "## Experience\n\n"
        "- Project Manager, University of Oxford (2018 - 2020), Remote.\n\n"
        "## Education\n\n"
        "BSc Computer Science"
    ),
    expected_item_keywords=[["project manager", "university of oxford", "2018", "2020"]],
)

multi_roles_mixed_with_headings = CVParserTestCase(
    name="multi_roles_mixed_with_headings",
    markdown_cv=(
        "# Jane Smith\n\n"
        "## Experience\n\n"
        "- Software Architect, ProUbis GmbH, Berlin (2010 - 2018)\n"
        "- Volunteer Instructor, Community Center, Berlin (2015 - 2017)\n"
        "- Internship, Ubis GmbH, Berlin (1998)\n"
    ),
    expected_item_keywords=[
        ["software architect", "proubis", "berlin", "2010", "2018"],
        ["volunteer", "instructor", "community center", "berlin", "2015", "2017"],
        ["intern", "ubis", "1998"],
    ],
)

entrepreneurship_case = CVParserTestCase(
    name="entrepreneurship_case",
    markdown_cv=(
        "# Alex Roe\n\n"
        "## Professional Experience\n\n"
        "- Co-founded Acme Inc. (2022 - Present), CEO, Washington, DC, USA\n"
        "- Owner, Dinner For Two, Berlin (2010 - 2020)\n"
    ),
    expected_item_keywords=[
        ["co-founded", "acme", "2022", "ceo"],
        ["dinner for two", "berlin", "2010", "2020"],
    ],
)

table_markdown = CVParserTestCase(
    name="table_markdown",
    markdown_cv=(
        "# CV\n\n"
        "| Role | Company | Years |\n|------|---------|-------|\n| Developer | Freelance | 2020-2022 |\n\n"
        "Responsibilities:\n\n* Built apps\n* Deployed systems\n"
    ),
    expected_item_keywords=[["developer", "freelance", "2020", "2022"]],
)

projects_vs_jobs = CVParserTestCase(
    name="projects_vs_jobs",
    markdown_cv=(
        "# Sam Doe\n\n"
        "## Experience\n\n"
        "- Data Engineer, Alpha Corp, Paris (2019 - 2023)\n"
        "- Barista, GoodBrew LLC, Lyon (2016 - 2019)\n\n"
        "## Projects\n\n"
        "- Built a data lake on S3 and Spark\n"
        "- Made delicious coffee for thousands of customers\n"
        "- Migrated on-prem ETL to Airflow\n"
    ),
    expected_item_keywords=[
        ["data engineer", "alpha", "paris", "2019", "2023"],
        ["barista", "goodbrew", "lyon", "2016", "2019"],
    ],
)

prose_only = CVParserTestCase(
    name="prose_only",
    markdown_cv=(
        """I started my career in 2012 as a junior accountant at Maple & Co in Toronto.
         Later I worked as a financial analyst at NorthBank from 2015 to 2020 in Ottawa.
         Since 2021 I have been a freelance consultant in Montreal."""
    ),
    expected_item_keywords=[
        ["junior accountant", "maple", "toronto", "2012"],
        ["financial analyst", "northbank", "ottawa", "2015", "2020"],
        ["freelance consultant", "montreal", "2021"],
    ],
)

tables_mixed_complex = CVParserTestCase(
    name="tables_mixed_complex",
    markdown_cv=(
        "## Experience Table\n\n"
        "| Role | Company | City | Years |\n|---|---|---|---|\n"
        "| DevOps Engineer | Cloudify | Paris | 2017-2021 |\n"
        "| Support Tech | HelpMe Ltd | Marseille | 2015-2017 |\n\n"
        "## Notes\n\nSome extra text not related to experience."
    ),
    expected_item_keywords=[
        ["devops", "cloudify", "paris", "2017", "2021"],
        ["support", "helpme", "marseille", "2015", "2017"],
    ],
)

images_links_case = CVParserTestCase(
    name="images_links_case",
    markdown_cv=(
        "![Logo](https://example.com/logo.png)\n\n"
        "### Experience\n\n"
        "- **QA Engineer** at [QualityWorks](https://quality.works) (2019 - Present), Remote\n"
        "- **Tester** at OldCo (2017 - 2019), On-site\n"
    ),
    expected_item_keywords=[
        ["qa engineer", "qualityworks", "2019"],
        ["tester", "oldco", "2017", "2019"],
    ],
)

chaotic_irregular_case = CVParserTestCase(
    name="chaotic_irregular_case",
    markdown_cv=(
        "Jobs I had: Developer@X (2013-2016) London;\n"
        "Then manager @ Y Corp: 2016 to 2018 (Berlin).\n"
        "Finally product lead Zeta 2019-present, Remote."
    ),
    expected_item_keywords=[
        ["developer", "london", "2013", "2016"],
        ["manager", "y corp", "berlin", "2016", "2018"],
        ["product lead", "zeta", "2019"],
    ],
)

partial_missing_info = CVParserTestCase(
    name="partial_missing_info",
    markdown_cv=(
        "- Designer, Artify\n"
        "- Writer, FreePress (2018-)\n"
    ),
    # Allow extracting only the well-specified line; "Designer, Artify" lacks timeframe
    expected_item_keywords=[["writer", "freepress", "2018"]],
)

date_variety_case = CVParserTestCase(
    name="date_variety_case",
    markdown_cv=(
        "- Analyst, DataHaus (03/2014 - 11/2016)\n"
        "- Engineer, MakeIt (2017/01-2019/12)\n"
        "- Consultant, BizCo (since 2020)\n"
    ),
    expected_item_keywords=[
        ["analyst", "datahaus", "2014", "2016"],
        ["engineer", "makeit", "2017", "2019"],
        ["consultant", "bizco", "2020"],
    ],
)

unpaid_signals_case = CVParserTestCase(
    name="unpaid_signals_case",
    markdown_cv=(
        "- Volunteer Teacher, Local School (2012-2013)\n"
        "- Caregiver, Family (2014-2016)\n"
        "- Internship, StartHub (2011)\n"
    ),
    expected_item_keywords=[
        ["volunteer", "teacher", "2012", "2013"],
        ["caregiver", "family", "2014", "2016"],
        ["intern", "starthub", "2011"],
    ],
)

multilingual_case = CVParserTestCase(
    name="multilingual_case",
    markdown_cv=(
        "- Développeur, Société Générale, Paris (2010-2012)\n"
        "- Ingeniero, Telefónica, Madrid (2013-2015)\n"
    ),
    expected_item_keywords=[
        ["développeur", "société générale", "paris", "2010", "2012"],
        ["ingeniero", "telefónica", "madrid", "2013", "2015"],
    ],
)

duplicates_case = CVParserTestCase(
    name="duplicates_case",
    markdown_cv=(
        "- Sales Associate, ShopCo (2018-2020)\n"
        "- Sales Associate, ShopCo (2018-2020)\n"
        "- Sales Associate, ShopCo (2018-2020)\n"
    ),
    expected_item_keywords=[["sales associate", "shopco", "2018", "2020"]],
)

long_cv_case = CVParserTestCase(
    name="long_cv_case",
    markdown_cv=(
        "- Role1, C1 (2008-2009)\n- Role2, C2 (2009-2010)\n- Role3, C3 (2010-2011)\n- Role4, C4 (2011-2012)\n- Role5, C5 (2012-2013)\n- Role6, C6 (2013-2014)\n- Role7, C7 (2014-2015)\n- Role8, C8 (2015-2016)\n"
    ),
    expected_item_keywords=[
        ["role1", "c1", "2008", "2009"],
        ["role2", "c2", "2009", "2010"],
        ["role3", "c3", "2010", "2011"],
        ["role4", "c4", "2011", "2012"],
        ["role5", "c5", "2012", "2013"],
        ["role6", "c6", "2013", "2014"],
        ["role7", "c7", "2014", "2015"],
        ["role8", "c8", "2015", "2016"],
    ],
)

off_topic_case = CVParserTestCase(
    name="off_topic_case",
    markdown_cv=(
        "# About Me\n\nI enjoy hiking, chess, and baking bread. No job history listed here."
    ),
    expected_item_keywords=[],
)

test_cases: list[CVParserTestCase] = [
    simple_single_role_with_headings,
    multi_roles_mixed_with_headings,
    entrepreneurship_case,
    table_markdown,
    projects_vs_jobs,
    prose_only,
    tables_mixed_complex,
    images_links_case,
    chaotic_irregular_case,
    partial_missing_info,
    date_variety_case,
    unpaid_signals_case,
    multilingual_case,
    duplicates_case,
    long_cv_case,
    off_topic_case,
]   


