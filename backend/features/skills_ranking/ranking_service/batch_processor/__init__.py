"""
This module serves as an entry point for the batch processor component of the skill ranking service.

This module is used to check all the existing jobseekers in the database, re-run the ranking algorithm and update their ranks.
It is intended to run only when the opportunity dataset has changed. (in life, if new opportunities are added, the % of opportunities you can apply for changes)

For now, we have a CLI script, but for v2 we will build and upload the source code here into the cloud batch processor service to run this periodically or on trigger.
"""
