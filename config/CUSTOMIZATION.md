# Compass Customization Guide

This guide explains how to customize the Compass application. It covers branding, features, and configuration options available to partners.

## Overview

Compass can be customized through a configuration system that uses JSON files. The configuration is injected into both the frontend and backend during the deployment process.

## Configuration File

The main configuration file is `config/default.json`. This file controls all customizable aspects of the application.

### Structure

The configuration file is organized into namespaces:

* **branding**: Application name, colors, logos, SEO metadata
* **auth**: Authentication settings
* **cv**: CV feature settings
* **skillsReport**: Skills report configuration (logos, formats, content)
* **i18n**: Internationalization and localization settings

## Branding Configuration

### Application Identity

* **appName**: The name displayed throughout the application
* **browserTabTitle**: The text shown in the browser tab

### SEO Metadata

* **metaDescription**: Description for search engines
* **seo.name**: Site name for search results
* **seo.url**: The public URL of the application
* **seo.image**: Image URL for social media sharing
* **seo.description**: Detailed description for SEO

### Assets

* **assets.logo**: Main logo (SVG recommended)
* **assets.favicon**: Browser favicon (SVG or ICO)
* **assets.appIcon**: App icon for mobile devices

Assets should be placed in the frontend `public` directory or hosted externally.

### Theme Colors

Colors are defined as RGB values (e.g., "0 255 145"). The following colors can be customized:

* **brand-primary**: Main brand color
* **brand-primary-light**: Lighter variant
* **brand-primary-dark**: Darker variant
* **brand-primary-contrast-text**: Text color on primary background
* **brand-secondary**: Secondary brand color
* **brand-secondary-light**: Lighter variant
* **brand-secondary-dark**: Darker variant
* **brand-secondary-contrast-text**: Text color on secondary background
* **text-primary**: Primary text color
* **text-secondary**: Secondary text color
* **text-accent**: Accent text color

**Important:** To ensure accessibility, run Storybook locally to preview color combinations and run the accessibility tests before committing.

## Skills Report Configuration

The skills report can be customized to display partner branding and control the format and content of generated reports.

### Report Logos

* **skillsReport.logos**: Array of logo objects to display in reports
  * **url**: Path to the logo image file
  * **docxStyles**: Dimensions for DOCX format (width, height in pixels)
  * **pdfStyles**: Dimensions for PDF format (height in pixels)

Multiple logos can be displayed (e.g., partner logo and co-branding logos).

### Download Formats

* **skillsReport.downloadFormats**: Array of available download formats (e.g., ["DOCX", "PDF"])

### Report Content

* **skillsReport.report.summary.show**: Show or hide the summary section 
* **skillsReport.report.experienceDetails**: Control which experience fields are shown:
  * **title**: Show job title 
  * **summary**: Show experience summary 
  * **location**: Show location 
  * **dateRange**: Show date range 
  * **companyName**: Show company name 

## Localization Configuration

Compass supports multiple languages through the i18n configuration.

### User Interface Locales

* **i18n.ui.defaultLocale**: Default language for the user interface (e.g., "en-US")
* **i18n.ui.supportedLocales**: Array of available UI languages (e.g., ["en-US", "en-GB", "es-ES"])

### Conversation Locales

* **i18n.conversation.default_locale**: Default language for conversations
* **i18n.conversation.available_locales**: Array of conversation locale configurations
  * **locale**: Locale code (e.g., "en-US")
  * **date_format**: Date format for this locale (e.g., "YYYY/MM/DD")

For complete language setup including translation files, see the [Language Guide](../add-a-new-language.md).

## Feature Configuration

### CV

* **cv.enabled**: Enable or disable CV functionality 

When disabled, all CV UI elements are hidden and API endpoints are not registered.

### Authentication

* **auth.disableLoginCode**: Disable login code requirement 
* **auth.disableRegistrationCode**: Disable registration code requirement 

## Applying Configuration Locally

The configuration is applied using the `inject-config.py` script.

Navigate to the config directory and run:

```bash
cd config
python3 inject-config.py
```

This script reads the JSON file and updates:

* Backend `.env` file
* Frontend `public/data/env.js` file

You can apply only specific top-level namespaces from `default.json`:

```bash
python3 inject-config.py --config default.json --namespaces branding auth
```

## Configuration Reference

See [default.json](default.json) for the complete configuration structure and available options.

## Important Notes

* If an environment variable is missing or contains a typo, the application will use default fallback values
* Ensure JSON keys match the structure in [default.json](default.json) exactly
