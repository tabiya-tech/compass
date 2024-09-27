# Authentication Hierarchy Documentation

## Introduction

This document provides an overview of the authentication hierarchy in the frontend application. 

## Authentication Services

The authentication system consists of several services that work together to handle user authentication, state management, and persistent storage. The main
services are:

- [`AuthenticationService`](src/auth/services/Authentication.service.ts) (abstract class): An abstract base class that defines common methods for authentication
  services.
- [`StdFirebaseAuthenticationService`](src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService.ts): A utility class that provides a
  base implementation for Firebase authentication services.
- [`FirebaseEmailAuthenticationService`, `FirebaseSocialAuthenticationService`,
  `FirebaseInvitationCodeAuthenticationService`](src/auth/services/FirebaseAuthenticationService): Extend the AuthenticationService class and handle specific
  authentication methods (email/password, social providers, anonymous).
- [`AuthenticationStateService`](src/auth/services/AuthenticationState.service.ts): Manages the current user's authentication state and token.
- [`UserPreferencesStateService`](src/userPreferences/UserPreferencesService/userPreferences.service.ts): Manages the user's preferences and settings.
- [`PersistentStorageService`](src/app/PersistentStorageService/PersistentStorageService.ts): A utility class for storing and retrieving data from the browser's
  local storage.


```mermaid
    graph TD
  AuthenticationService[<strong>AuthenticationService</strong><br><i>Abstract base class for auth operations<br>Responsibilities: update the application state after login,logout and registration</i>]
    
    style AuthenticationService text-align: left
    StdFirebaseAuthenticationService[<strong>StdFirebaseAuthenticationService</strong><br><i>Base implementation for Firebase auth<br>Responsibilities: handles auth tasks that are common to all firebase auth methods such as<br>token refresh, logout, and Firebase DB deletion.<br>Does not handle the actual authentication process #40;login, register#41;</i>]
style StdFirebaseAuthenticationService text-align:left

FirebaseEmailAuthenticationService[<strong>FirebaseEmailAuthenticationService</strong><br><i>Handles email/password auth flows<br>Responsibilities: handles registration, login, and logout</i>]
style FirebaseEmailAuthenticationService text-align:left

FirebaseSocialAuthenticationService[<strong>FirebaseSocialAuthenticationService</strong><br><i>Handles social auth provider flows<br>Responsibilities: handles login with social providers and logout</i>]
style FirebaseSocialAuthenticationService text-align: left

FirebaseInvitationCodeAuthenticationService[<strong>FirebaseInvitationCodeAuthenticationService</strong><br><i>Handles anonymous auth flows<br>Responsibilities: handles login with invitation code and logout</i>]
style FirebaseInvitationCodeAuthenticationService text-align: left

AuthenticationStateService[<strong>AuthenticationStateService</strong><br/><i>Manages current user auth state<br>Responsibilities: <li>store and retrieve the user token and login method</li><li>get, set and clear the current user</li></i>]
style AuthenticationStateService text-align: left

UserPreferencesStateService[<strong>UserPreferencesStateService</strong><br/><i>Manages user settings & preferences state<br>Responsibilities: get, set and clear user preferences</i>]
style UserPreferencesStateService text-align: left

PersistentStorageService[<strong>PersistentStorageService</strong><br/><i>A utility class for storing and retrieving data from the browser's local storage<br>Responsibilities: get, set and remove the user token and login method</i>]
style PersistentStorageService text-align: left

%% Relationships

%% Add invisible connections to force the AuthenticationService to be placed at the top
AuthenticationService --- FirebaseEmailAuthenticationService
linkStyle 0 stroke-width: 0px
AuthenticationService --- FirebaseSocialAuthenticationService
linkStyle 1 stroke-width: 0px
AuthenticationService  --- FirebaseInvitationCodeAuthenticationService
linkStyle 2 stroke-width: 0px
%% -------------------

FirebaseEmailAuthenticationService -- extends --> AuthenticationService
FirebaseSocialAuthenticationService -- extends--> AuthenticationService
FirebaseInvitationCodeAuthenticationService  -- extends --> AuthenticationService

FirebaseEmailAuthenticationService -- uses --> StdFirebaseAuthenticationService
FirebaseSocialAuthenticationService -- uses --> StdFirebaseAuthenticationService
FirebaseInvitationCodeAuthenticationService -- uses --> StdFirebaseAuthenticationService

StdFirebaseAuthenticationService -- uses --> AuthenticationStateService
StdFirebaseAuthenticationService -- uses --> UserPreferencesStateService
StdFirebaseAuthenticationService -- uses --> PersistentStorageService

AuthenticationStateService -- uses --> PersistentStorageService
```

## Login Flow

The following sequence diagram illustrates the login flow for different authentication methods (email/password, social providers, anonymous):

```mermaid
sequenceDiagram
    participant User
    participant Login Page
    participant Authentication Service

    box App State Management Services
        participant Authentication State Service
        participant User Preferences State Service
    end

    participant Authentication Service
    participant Persistent Storage Service
    participant Main Application
    User ->> Login Page: Navigate to Login Page
    Login Page ->> User: Display login options (Email, Social, Invitation Code)
    User ->> Login Page: Select login method
    User ->> Login Page: Enter login credentials
    Login Page ->> Authentication Service: Call login method
    Authentication Service ->> 3rd Party Provider: Authenticate user
    3rd Party Provider -->> Authentication Service: Return user token
    Authentication Service ->> Persistent Storage Service: Store login method ("Email", "Google", "Anonymous", etc.)
    Authentication Service -->> Login Page: Return user token
    Authentication Service ->> Authentication State Service: Update user state with token
    Authentication Service ->> Persistent Storage Service: Store token
    Login Page ->> Main Application: Redirect user
    Main Application ->> User Preferences State Service: Load user preferences
```

## Logout Flow

The following sequence diagram illustrates the logout flow:

```mermaid
sequenceDiagram
    participant User
    participant Main Application
    participant Authentication Service
    participant Persistent Storage Service
    participant Authentication Service

    box App State Management Services
        participant Authentication State Service
        participant User Preferences State Service
    end

    participant Login Page
    User ->> Main Application: Initiate Logout
    Main Application ->> Authentication Service: Call logout method
    Authentication Service ->> Persistent Storage Service: Retrieve login method
    Authentication Service ->> 3rd Party Provider: Logout user
    Authentication Service ->> Authentication State Service: Clear user state
    Authentication Service ->> Persistent Storage Service: Remove token
    Authentication Service ->> Persistent Storage Service: Remove login method
    Authentication Service ->> User Preferences State Service: Clear user preferences
    Authentication Service -->> Main Application: Logout successful
    Main Application ->> Login Page: Redirect user
```