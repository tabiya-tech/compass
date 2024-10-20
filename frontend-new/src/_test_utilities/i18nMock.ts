import i18n, { TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const mockUseTranslation = jest.fn().mockReturnValue({
  t: (key: string) => key,
  i18n: {
    changeLanguage: jest.fn().mockResolvedValue({}),
  },
});

jest.mock('react-i18next', () => ({
  useTranslation: () => mockUseTranslation(),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

jest.spyOn(i18n, 'use').mockReturnValue(i18n);
jest.spyOn(i18n, 'init').mockResolvedValue(i18n as unknown as TFunction<"translation", undefined>);

export const setupI18nMock = () => {
  i18n.use(initReactI18next).init({
    resources: {},
    lng: 'en',
  });
};