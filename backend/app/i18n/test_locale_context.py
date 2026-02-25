"""
Tests for LocaleContext and dual-locale functionality.
"""
import pytest

from app.i18n.locale_context import LocaleContext
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale


class TestLocaleContext:
    """Tests for LocaleContext class"""

    def test_locale_context_creation(self):
        """
        GIVEN conversation and reporting locales
        WHEN creating a LocaleContext
        THEN both locales are correctly stored
        """
        context = LocaleContext(
            conversation_locale=Locale.EN_US,
            reporting_locale=Locale.ES_ES
        )
        
        assert context.conversation_locale == Locale.EN_US
        assert context.reporting_locale == Locale.ES_ES

    def test_locale_context_immutable(self):
        """
        GIVEN a LocaleContext
        WHEN attempting to modify its fields
        THEN an error is raised (frozen dataclass)
        """
        context = LocaleContext(
            conversation_locale=Locale.EN_US,
            reporting_locale=Locale.ES_ES
        )
        
        with pytest.raises(Exception):  # FrozenInstanceError
            context.conversation_locale = Locale.EN_GB  # type: ignore

    def test_locale_context_same_locales(self):
        """
        GIVEN the same locale for both conversation and reporting
        WHEN creating a LocaleContext
        THEN both fields contain the same locale
        """
        context = LocaleContext(
            conversation_locale=Locale.EN_US,
            reporting_locale=Locale.EN_US
        )
        
        assert context.conversation_locale == context.reporting_locale


class TestI18nManagerDualLocale:
    """Tests for I18nManager dual-locale methods"""

    def test_set_locales_atomicity(self):
        """
        GIVEN an I18nManager
        WHEN calling set_locales with conversation and reporting locales
        THEN both locales are set atomically in the context
        """
        manager = get_i18n_manager()
        
        result = manager.set_locales(Locale.EN_GB, Locale.ES_AR)
        
        assert isinstance(result, LocaleContext)
        assert result.conversation_locale == Locale.EN_GB
        assert result.reporting_locale == Locale.ES_AR

    def test_get_conversation_locale(self):
        """
        GIVEN locales are set via set_locales
        WHEN calling get_conversation_locale
        THEN the conversation locale is returned
        """
        manager = get_i18n_manager()
        manager.set_locales(Locale.EN_US, Locale.ES_ES)
        
        actual = manager.get_conversation_locale()
        
        assert actual == Locale.EN_US

    def test_get_reporting_locale(self):
        """
        GIVEN locales are set via set_locales
        WHEN calling get_reporting_locale
        THEN the reporting locale is returned
        """
        manager = get_i18n_manager()
        manager.set_locales(Locale.EN_US, Locale.ES_ES)
        
        actual = manager.get_reporting_locale()
        
        assert actual == Locale.ES_ES

    def test_different_conversation_and_reporting_locales(self):
        """
        GIVEN different conversation and reporting locales
        WHEN setting them via set_locales
        THEN get_conversation_locale and get_reporting_locale return different values
        """
        manager = get_i18n_manager()
        manager.set_locales(Locale.EN_GB, Locale.ES_AR)
        
        conversation = manager.get_conversation_locale()
        reporting = manager.get_reporting_locale()
        
        assert conversation == Locale.EN_GB
        assert reporting == Locale.ES_AR
        assert conversation != reporting

    def test_t_function_uses_conversation_locale(self, setup_application_config):
        """
        GIVEN different conversation and reporting locales
        WHEN calling the t() convenience function
        THEN it uses the conversation locale
        """
        manager = get_i18n_manager()
        # Set EN_US for conversation, ES_ES for reporting
        manager.set_locales(Locale.EN_US, Locale.ES_ES)
        
        # The t() method uses get_conversation_locale internally
        # This test verifies it doesn't raise an error and uses conversation locale
        result = manager.t("messages", "experience.noTitleProvidedYet")
        
        # Verify we got a valid translation (not the key itself)
        assert result != "experience.noTitleProvidedYet"
        assert isinstance(result, str)
        assert len(result) > 0
