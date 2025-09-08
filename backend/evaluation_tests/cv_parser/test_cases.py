from textwrap import dedent

from typing import Any
from pydantic import BaseModel

from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.matcher import ContainsString


class CVParserTestCase(CompassTestCase):
    name: str
    markdown_cv: str
    # Behavioral expectations: a list of experience constraints. Each entry can be:
    # - a list of matchers/expected-values (ALL must match within a single extracted line)
    # - a single matcher/expected-value (must match a single extracted line)
    # Expected values are matchers (e.g., ContainsString), regex patterns, or plain values.
    expected_experiences: list[Any]


simple_single_role_with_headings = CVParserTestCase(
    name="simple_single_role_with_headings",
    markdown_cv=(
        "# John Doe\n\n"
        "## Experience\n\n"
        "- Project Manager, University of Oxford (2018 - 2020), Remote.\n\n"
        "## Education\n\n"
        "BSc Computer Science"
    ),
    expected_experiences=[[
        ContainsString("project manager", case_sensitive=False),
        ContainsString("university of oxford", case_sensitive=False),
        ContainsString("2018", case_sensitive=False),
        ContainsString("2020", case_sensitive=False),
    ]],
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
    expected_experiences=[
        [ContainsString("software architect", case_sensitive=False), ContainsString("proubis", case_sensitive=False), ContainsString("berlin", case_sensitive=False), ContainsString("2010", case_sensitive=False), ContainsString("2018", case_sensitive=False)],
        [ContainsString("volunteer", case_sensitive=False), ContainsString("instructor", case_sensitive=False), ContainsString("community center", case_sensitive=False), ContainsString("berlin", case_sensitive=False), ContainsString("2015", case_sensitive=False), ContainsString("2017", case_sensitive=False)],
        [ContainsString("intern", case_sensitive=False), ContainsString("ubis", case_sensitive=False), ContainsString("1998", case_sensitive=False)],
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
    expected_experiences=[
        [ContainsString("co-founded", case_sensitive=False), ContainsString("acme", case_sensitive=False), ContainsString("2022", case_sensitive=False), ContainsString("ceo", case_sensitive=False)],
        [ContainsString("dinner for two", case_sensitive=False), ContainsString("berlin", case_sensitive=False), ContainsString("2010", case_sensitive=False), ContainsString("2020", case_sensitive=False)],
    ],
)

table_markdown = CVParserTestCase(
    name="table_markdown",
    markdown_cv=(
        "# CV\n\n"
        "| Role | Company | Years |\n|------|---------|-------|\n| Developer | Freelance | 2020-2022 |\n\n"
        "Responsibilities:\n\n* Built apps\n* Deployed systems\n"
    ),
    expected_experiences=[[
        ContainsString("developer", case_sensitive=False),
        ContainsString("freelance", case_sensitive=False),
        ContainsString("2020", case_sensitive=False),
        ContainsString("2022", case_sensitive=False),
    ]],
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
    expected_experiences=[
        [ContainsString("data engineer", case_sensitive=False), ContainsString("alpha", case_sensitive=False), ContainsString("paris", case_sensitive=False), ContainsString("2019", case_sensitive=False), ContainsString("2023", case_sensitive=False)],
        [ContainsString("barista", case_sensitive=False), ContainsString("goodbrew", case_sensitive=False), ContainsString("lyon", case_sensitive=False), ContainsString("2016", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
    ],
)

prose_only = CVParserTestCase(
    name="prose_only",
    markdown_cv=(
        """I started my career in 2012 as a junior accountant at Maple & Co in Toronto.
         Later I worked as a financial analyst at NorthBank from 2015 to 2020 in Ottawa.
         Since 2021 I have been a freelance consultant in Montreal."""
    ),
    expected_experiences=[
        [ContainsString("junior accountant", case_sensitive=False), ContainsString("maple", case_sensitive=False), ContainsString("toronto", case_sensitive=False), ContainsString("2012", case_sensitive=False)],
        [ContainsString("financial analyst", case_sensitive=False), ContainsString("northbank", case_sensitive=False), ContainsString("ottawa", case_sensitive=False), ContainsString("2015", case_sensitive=False), ContainsString("2020", case_sensitive=False)],
        [ContainsString("freelance consultant", case_sensitive=False), ContainsString("montreal", case_sensitive=False), ContainsString("2021", case_sensitive=False)],
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
    expected_experiences=[
        [ContainsString("devops", case_sensitive=False), ContainsString("cloudify", case_sensitive=False), ContainsString("paris", case_sensitive=False), ContainsString("2017", case_sensitive=False), ContainsString("2021", case_sensitive=False)],
        [ContainsString("support", case_sensitive=False), ContainsString("helpme", case_sensitive=False), ContainsString("marseille", case_sensitive=False), ContainsString("2015", case_sensitive=False), ContainsString("2017", case_sensitive=False)],
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
    expected_experiences=[
        [ContainsString("qa engineer", case_sensitive=False), ContainsString("qualityworks", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
        [ContainsString("tester", case_sensitive=False), ContainsString("oldco", case_sensitive=False), ContainsString("2017", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
    ],
)

chaotic_irregular_case = CVParserTestCase(
    name="chaotic_irregular_case",
    markdown_cv=(
        "Jobs I had: Developer@X (2013-2016) London;\n"
        "Then manager @ Y Corp: 2016 to 2018 (Berlin).\n"
        "Finally product lead Zeta 2019-present, Remote."
    ),
    expected_experiences=[
        [ContainsString("developer", case_sensitive=False), ContainsString("london", case_sensitive=False), ContainsString("2013", case_sensitive=False), ContainsString("2016", case_sensitive=False)],
        [ContainsString("manager", case_sensitive=False), ContainsString("y corp", case_sensitive=False), ContainsString("berlin", case_sensitive=False), ContainsString("2016", case_sensitive=False), ContainsString("2018", case_sensitive=False)],
        [ContainsString("product lead", case_sensitive=False), ContainsString("zeta", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
    ],
)

partial_missing_info = CVParserTestCase(
    name="partial_missing_info",
    markdown_cv=(
        "- Designer, Artify\n"
        "- Writer, FreePress (2018-)\n"
    ),
    # Allow extracting only the well-specified line; "Designer, Artify" lacks timeframe
    expected_experiences=[[
        ContainsString("designer", case_sensitive=False),
        ContainsString("artify", case_sensitive=False)
    ],
    [
        ContainsString("writer", case_sensitive=False),
        ContainsString("freepress", case_sensitive=False),
        ContainsString("2018", case_sensitive=False),
    ]],
)

date_variety_case = CVParserTestCase(
    name="date_variety_case",
    markdown_cv=(
        "- Analyst, DataHaus (03/2014 - 11/2016)\n"
        "- Engineer, MakeIt (2017/01-2019/12)\n"
        "- Consultant, BizCo (since 2020)\n"
    ),
    expected_experiences=[
        [ContainsString("analyst", case_sensitive=False), ContainsString("datahaus", case_sensitive=False), ContainsString("2014", case_sensitive=False), ContainsString("2016", case_sensitive=False)],
        [ContainsString("engineer", case_sensitive=False), ContainsString("makeit", case_sensitive=False), ContainsString("2017", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
        [ContainsString("consultant", case_sensitive=False), ContainsString("bizco", case_sensitive=False), ContainsString("2020", case_sensitive=False)],
    ],
)

unpaid_signals_case = CVParserTestCase(
    name="unpaid_signals_case",
    markdown_cv=(
        "- Volunteer Teacher, Local School (2012-2013)\n"
        "- Caregiver, Family (2014-2016)\n"
        "- Internship, StartHub (2011)\n"
    ),
    expected_experiences=[
        [ContainsString("volunteer", case_sensitive=False), ContainsString("teacher", case_sensitive=False), ContainsString("2012", case_sensitive=False), ContainsString("2013", case_sensitive=False)],
        [ContainsString("caregiver", case_sensitive=False), ContainsString("family", case_sensitive=False), ContainsString("2014", case_sensitive=False), ContainsString("2016", case_sensitive=False)],
        [ContainsString("intern", case_sensitive=False), ContainsString("starthub", case_sensitive=False), ContainsString("2011", case_sensitive=False)],
    ],
)

multilingual_case = CVParserTestCase(
    name="multilingual_case",
    markdown_cv=(
        "- Développeur, Société Générale, Paris (2010-2012)\n"
        "- Ingeniero, Telefónica, Madrid (2013-2015)\n"
        "- 软件工程师, 腾讯, 深圳 (2016-2018)\n"
        "- 产品经理, 阿里巴巴, 杭州 (2019-2021)\n"
        "- የፕሮግራሚንግ ባለሙያ, አዲስ አበባ ቴክ, አዲስ አበባ (2017-2019)\n"
        "- ማህበረሰብ አስተዳደር, ኢትዮጵያ ሶፍትዌር, አዲስ አበባ (2020-2022)\n"
    ),
    expected_experiences=[
        [ContainsString("développeur", case_sensitive=False), ContainsString("société générale", case_sensitive=False), ContainsString("paris", case_sensitive=False), ContainsString("2010", case_sensitive=False), ContainsString("2012", case_sensitive=False)],
        [ContainsString("ingeniero", case_sensitive=False), ContainsString("telefónica", case_sensitive=False), ContainsString("madrid", case_sensitive=False), ContainsString("2013", case_sensitive=False), ContainsString("2015", case_sensitive=False)],
        [ContainsString("软件工程师", case_sensitive=False), ContainsString("腾讯", case_sensitive=False), ContainsString("深圳", case_sensitive=False), ContainsString("2016", case_sensitive=False), ContainsString("2018", case_sensitive=False)],
        [ContainsString("产品经理", case_sensitive=False), ContainsString("阿里巴巴", case_sensitive=False), ContainsString("杭州", case_sensitive=False), ContainsString("2019", case_sensitive=False), ContainsString("2021", case_sensitive=False)],
        [ContainsString("የፕሮግራሚንግ ባለሙያ", case_sensitive=False), ContainsString("አዲስ አበባ ቴክ", case_sensitive=False), ContainsString("አዲስ አበባ", case_sensitive=False), ContainsString("2017", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
        [ContainsString("ማህበረሰብ አስተዳደር", case_sensitive=False), ContainsString("ኢትዮጵያ ሶፍትዌር", case_sensitive=False), ContainsString("አዲስ አበባ", case_sensitive=False), ContainsString("2020", case_sensitive=False), ContainsString("2022", case_sensitive=False)],
    ]
)

duplicates_case = CVParserTestCase(
    name="duplicates_case",
    markdown_cv=(
        "- Sales Associate, ShopCo (2018-2020)\n"
        "- Sales Associate, ShopCo (2018-2020)\n"
        "- Sales Associate, ShopCo (2018-2020)\n"
    ),
    expected_experiences=[[
        ContainsString("sales associate", case_sensitive=False),
        ContainsString("shopco", case_sensitive=False),
        ContainsString("2018", case_sensitive=False),
        ContainsString("2020", case_sensitive=False),
    ]],
)

long_cv_case = CVParserTestCase(
    name="long_cv_case",
    markdown_cv=(
        "- Role1, C1 (2008-2009)\n- Role2, C2 (2009-2010)\n- Role3, C3 (2010-2011)\n- Role4, C4 (2011-2012)\n- Role5, C5 (2012-2013)\n- Role6, C6 (2013-2014)\n- Role7, C7 (2014-2015)\n- Role8, C8 (2015-2016)\n"
    ),
    expected_experiences=[
        [ContainsString("role1", case_sensitive=False), ContainsString("c1", case_sensitive=False), ContainsString("2008", case_sensitive=False), ContainsString("2009", case_sensitive=False)],
        [ContainsString("role2", case_sensitive=False), ContainsString("c2", case_sensitive=False), ContainsString("2009", case_sensitive=False), ContainsString("2010", case_sensitive=False)],
        [ContainsString("role3", case_sensitive=False), ContainsString("c3", case_sensitive=False), ContainsString("2010", case_sensitive=False), ContainsString("2011", case_sensitive=False)],
        [ContainsString("role4", case_sensitive=False), ContainsString("c4", case_sensitive=False), ContainsString("2011", case_sensitive=False), ContainsString("2012", case_sensitive=False)],
        [ContainsString("role5", case_sensitive=False), ContainsString("c5", case_sensitive=False), ContainsString("2012", case_sensitive=False), ContainsString("2013", case_sensitive=False)],
        [ContainsString("role6", case_sensitive=False), ContainsString("c6", case_sensitive=False), ContainsString("2013", case_sensitive=False), ContainsString("2014", case_sensitive=False)],
        [ContainsString("role7", case_sensitive=False), ContainsString("c7", case_sensitive=False), ContainsString("2014", case_sensitive=False), ContainsString("2015", case_sensitive=False)],
        [ContainsString("role8", case_sensitive=False), ContainsString("c8", case_sensitive=False), ContainsString("2015", case_sensitive=False), ContainsString("2016", case_sensitive=False)],
    ],
)

off_topic_case = CVParserTestCase(
    name="off_topic_case",
    markdown_cv=(
        "# About Me\n\nI enjoy hiking, chess, and baking bread. No job history listed here."
    ),
    expected_experiences=[],
)

# Realistic, noisy CV cases (multi-section, 2-3 pages feel)
realistic_full_cv = CVParserTestCase(
    name="realistic_full_cv",
    markdown_cv=dedent(
        """
        # John A. Doe
        123 Main Street, New York, NY 10001 | +1 212 555 1234 | john.doe@example.com | https://linkedin.com/in/johndoe
        
        ## Summary
        Seasoned engineer with 10+ years experience building cloud services and data platforms. Passionate about mentoring.
        
        ## Skills
        - Languages: Python, TypeScript, Go
        - Cloud: GCP, AWS
        
        ## Experience
        - Senior Software Engineer, Acme Corp, New York (2019 - Present)
          - Led migration of monolith to microservices
          - Reduced cloud spend by 20%
          
        - Project Manager, University of Oxford (2016 - 2018), Remote
          - Managed cross-functional team of 12
        
        - Owner, Doe Consulting, Boston (2014 - 2016)
        
        ## Projects
        - Open Source: Maintainer of data-utils
        
        ## Education
        - BSc Computer Science, MIT (2010 - 2014)
        
        ## Certifications
        - GCP Professional Cloud Architect (2020)
        
        ## References
        Available upon request.
        """
    ),
    expected_experiences=[
        [ContainsString("senior software engineer", case_sensitive=False), ContainsString("acme", case_sensitive=False), ContainsString("new york", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
        [ContainsString("project manager", case_sensitive=False), ContainsString("university of oxford", case_sensitive=False), ContainsString("2016", case_sensitive=False), ContainsString("2018", case_sensitive=False)],
        [ContainsString("owner", case_sensitive=False), ContainsString("doe consulting", case_sensitive=False), ContainsString("2014", case_sensitive=False), ContainsString("2016", case_sensitive=False)],
    ],
)

realistic_full_cv_with_noise = CVParserTestCase(
    name="realistic_full_cv_with_noise",
    markdown_cv=dedent(
        """
        # Jane Q. Public
        Address: 55 High Street, London SW1A 1AA, UK | Email: jane.public@mail.com | Phone: +44 20 7946 0958
        
        ## Personal Statement
        Curious builder and lifelong learner. Outside work: hiking, pottery, and volunteering.
        
        ## Experience
        - Data Engineer, Alpha Corp, Paris (2019 - 2023)
          - Built real-time pipelines on GCP (Pub/Sub, Dataflow)
        - Barista, GoodBrew LLC, Lyon (2016 - 2019)
          - Trained 5 junior baristas
          
        ## Projects
        - Personal: Portfolio website (https://jane.dev)
        
        ## Education
        - MSc Data Science, Sorbonne (2017 - 2019)
        
        ## Skills
        - Python, SQL, Airflow, Terraform
        
        ## Certifications
        - AWS Certified Solutions Architect (Associate) (2021)
        
        ## References
        - Available on request
        """),
    expected_experiences=[
        [ContainsString("data engineer", case_sensitive=False), ContainsString("alpha", case_sensitive=False), ContainsString("paris", case_sensitive=False), ContainsString("2019", case_sensitive=False), ContainsString("2023", case_sensitive=False)],
        [ContainsString("barista", case_sensitive=False), ContainsString("goodbrew", case_sensitive=False), ContainsString("lyon", case_sensitive=False), ContainsString("2016", case_sensitive=False), ContainsString("2019", case_sensitive=False)],
    ],
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
    realistic_full_cv,
    realistic_full_cv_with_noise,
]   


