import "src/_test_utilities/consoleMock";
import i18n from './i18n';
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from 'react-i18next';
import { act } from 'react-dom/test-utils';
import { useTranslation } from 'react-i18next';
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import en from '../../public/locales/languages/en.json';
import fr from '../../public/locales/languages/fr.json';

// Create a test component that uses translations
const TestComponent = () => {
  const { t } = useTranslation();
  act(() => {
    i18n.addResource(Language.en, 'translation', 'test.key', 'Test in English');
    i18n.addResource(Language.fr, 'translation', 'test.key', 'Test en français');
  })
  return <div>{t('test.key')}</div>;
};

describe('i18n translations', () => {
  test('should match english translation snapshot', () => {
    expect(en).toMatchSnapshot();
  });

  test('should match french translation snapshot', () => {
    expect(fr).toMatchSnapshot();
  });
});

describe('i18n configuration', () => {
  test('should initialize with correct settings', () => {
    expect(i18n.options.fallbackLng).toEqual(expect.arrayContaining([Language.en]));
    expect(i18n.options.debug).toBe(true);
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  test('should have Backend plugin', () => {
    expect(i18n.modules.backend).toBe(Backend);
  });

  test('should have LanguageDetector plugin', () => {
    expect(i18n.modules.languageDetector).toBe(LanguageDetector);
  });
});

describe('i18n centralized tests', () => {
  test('should change language', async () => {
    // GIVEN the i18n is initialized with English as the default language
    render(
        <TestComponent />
    );

    // WHEN the language is changed to French
    await act(async () => {
      await i18n.changeLanguage(Language.fr);
    });

    // THEN the text should be in French
    await waitFor(() => {
      expect(screen.getByText('Test en français')).toBeInTheDocument();
    });
  }, 10000); // Increase timeout to 10 seconds to wait for the language change

  test('should fall back to default language for missing translations', async () => {
    // GIVEN the i18n is initialized with English as the default language
    render(
      <I18nextProvider i18n={i18n}>
        <TestComponent />
      </I18nextProvider>
    );

    // WHEN the language is changed to a language with missing translations
    await act(async () => {
      await i18n.changeLanguage('de');
    });

    // THEN it should fall back to the English translation\
    await waitFor(() => {
      expect(screen.getByText('Test in English')).toBeInTheDocument();
    });
  }, 10000); // Increase timeout to 10 seconds to wait for the language change
});
