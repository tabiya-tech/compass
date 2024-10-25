## Authentication Hierarchy Documentation

### Introduction

This document provides an overview of the authentication hierarchy in the frontend application. It includes entity-relationship diagrams and sequence diagrams to illustrate the structure and flow of the authentication system.

### Authentication Services

The authentication system consists of several services that work together to handle user authentication, state management, and persistent storage. The main services are:
- [`AuthenticationService`](src/auth/services/Authentication.service.ts) (abstract class): An abstract base class that defines common methods for authentication services.
- )`: An abstract base class that defines common methods for authentication services.
- [`StdFirebaseAuthenticationService`](src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService.ts): A utility class that provides a base implementation for Firebase authentication services.
- `FirebaseEmailAuthenticationService`, `FirebaseSocialAuthenticationService`, `FirebaseInvitation CodeAuthenticationService`: Extend the AuthenticationService class and handle specific authentication methods (email/password, social providers, anonymous).
- `AuthenticationStateService`: Manages the current user's authentication state and token.
- `UserPreferencesStateService`: Manages the user's preferences and settings.
- `PersistentStorageUtil`: A utility class for storing and retrieving data from the browser's local storage.
### Entity-Relationship Diagram

>The following entity-relationship diagram illustrates the relationships between the main entities in the authentication system:

```mermaid
erDiagram
    User {
        string id
        string name
        string email
    }

    AuthenticationService {
        refreshToken() void
        cleanup() void
        logout() void
        onSuccessfulLogout()  void
        onSuccessfulLogin(token)  void
        onSuccessfulRegistration()  void
        onSuccessfulRefresh(token)  void
        
    }

    StdFirebaseAuthenticationService {
        refreshToken() void
        cleanup() void
        logout() void
        deleteFirebaseDB() void
        scheduleTokenRefresh(token) void
        clearRefreshTimeout() void
    }

    FirebaseEmailAuthenticationService {
        login(email-password) void
        signup(email-password) void
        sendPasswordResetEmail(email) void
    }

    FirebaseSocialAuthenticationService {
        loginWithProvider(provider) void
    }

    FirebaseInvitationCodeAuthenticationService {
        login()  void
    }

    AuthenticationStateService {
        getCurrentUser() User
        setCurrentUser(user) void
        getToken() string
        setToken(token) void
        removeToken() void
        getLoginMethod() AuthenticationServices
        setLoginMethod(method) void
        removeLoginMethod() void
    }

    UserPreferencesStateService {
        getUserPreferences() UserPreferences
        setUserPreferences(preferences) void
        clearUserPreferences() void
    }

    PersistentStorageService {
        getToken() string
        setToken(token) void
        removeToken() void
        getLoginMethod() AuthenticationServices
        setLoginMethod(method) void
        removeLoginMethod() void
    }

    User ||--|| AuthenticationStateService : "current user"
    AuthenticationService ||--|| FirebaseEmailAuthenticationService : "extends"
    AuthenticationService ||--|| FirebaseSocialAuthenticationService : "extends"
    AuthenticationService ||--|| FirebaseInvitationCodeAuthenticationService : "extends"
    FirebaseEmailAuthenticationService ||--|| StdFirebaseAuthenticationService : "uses"
    FirebaseSocialAuthenticationService ||--|| StdFirebaseAuthenticationService : "uses"
    FirebaseInvitationCodeAuthenticationService ||--|| StdFirebaseAuthenticationService : "uses"
    StdFirebaseAuthenticationService ||--|{ AuthenticationStateService : "uses"
    StdFirebaseAuthenticationService ||--|{ UserPreferencesStateService : "uses"
    StdFirebaseAuthenticationService ||--|{ PersistentStorageService : "uses"
    AuthenticationStateService ||--|{ PersistentStorageService : "uses"
```
    
### Login Flow

>The following sequence diagram illustrates the login flow for different authentication methods (email/password, social providers, anonymous):
```mermaid
sequenceDiagram
participant User
participant Login Page

    box Firebase Authentication Services [ extends Authentication Service ]
    participant Firebase Email Authentication Service
    participant Firebase Invitation Code Authentication Service 
    participant Firebase Social Authentication Service
    end
    
    box App State Management Services
    participant Authentication State Service
    participant User Preferences State Service 
    end
        
    participant Authentication Service
    participant Persistent Storage Service
    
    participant Main Application

    User->>Login Page: Navigate to Login Page
    Login Page->>User: Display login options (Email, Social, Invitation Code)
    User->>Login Page: Select login method

    alt Email Login
        User->>Login Page: Enter email and password
        Login Page->>Firebase Email Authentication Service: Call login method
        Firebase Email Authentication Service->>Firebase: Authenticate user
        Firebase-->>Firebase Email Authentication Service: Return user token
        Firebase Email Authentication Service->>Authentication Service: Return user token
        Firebase Email Authentication Service->>Persistent Storage Service: Store login method as "Email"
        Authentication Service-->>Login Page: Return user token
    else Social Login
        User->>Login Page: Select social provider 
        Login Page->>Firebase Social Authentication Service: Call loginWithProvider method
        Firebase Social Authentication Service->>Firebase: Authenticate user
        Firebase-->>Firebase Social Authentication Service: Return user token
        Firebase Social Authentication Service->>Authentication Service: Return user token
        Firebase Social Authentication Service->>Persistent Storage Service: Store login method as "Social"
        Authentication Service-->>Login Page: Return user token
    else Invitation Code Login
        User->>Login Page: Select invitation code login
        Login Page->>Firebase Invitation Code Authentication Service: Call login method
        Firebase Invitation Code Authentication Service->>Firebase: Create anonymous user
        Firebase-->>Firebase Invitation Code Authentication Service: Return user token
        Firebase Invitation Code Authentication Service->>Authentication Service: Return user token
        Firebase Invitation Code Authentication Service->>Persistent Storage Service: Store login method as "Invitation Code"
        Authentication Service-->>Login Page: Return user token
    end

    Authentication Service->>Authentication State Service: Update user state with token
    Authentication Service->>Persistent Storage Service: Store token
    Login Page->>Main Application: Redirect user
    
    Main Application->>User Preferences State Service: Load user preferences
```
### Logout Flow
> The following sequence diagram illustrates the logout flow:
```mermaid
sequenceDiagram
participant User
participant Main Application
participant Authentication Service
participant Persistent Storage Service

    box Firebase Authentication Services [ extends Authentication Service ]
    participant Firebase Email Authentication Service
    participant Firebase Invitation Code Authentication Service
    participant Firebase Social Authentication Service
    end
    
    box App State Management Services
    participant Authentication State Service
    participant User Preferences State Service
    end
    
    participant Login Page

    User->>Main Application: Initiate Logout
    Main Application->>Authentication Service: Call logout method
    Authentication Service->>Persistent Storage Service: Retrieve login method
    alt Login method is "Email"
        Authentication Service->>Firebase Email Authentication Service: Call logout method
        Firebase Email Authentication Service->>Firebase: Logout user
    else Login method is "Social"  
        Authentication Service->>Firebase Social Authentication Service: Call logout method
        Firebase Social Authentication Service->>Firebase: Logout user
    else Login method is "Invitation Code"
        Authentication Service->>Firebase Invitation Code Authentication Service: Call logout method 
        Firebase Invitation Code Authentication Service->>Firebase: Logout user
    end
    Authentication Service->>Authentication State Service: Clear user state
    Authentication Service->>Persistent Storage Service: Remove token
    Authentication Service->>Persistent Storage Service: Remove login method
    Authentication Service->>User Preferences State Service: Clear user preferences
    Authentication Service-->>Main Application: Logout successful
    Main Application->>Login Page: Redirect user
```
## Key Responsibilities and Boundaries
### StdFirebaseAuthenticationService
- Provides a base implementation for Firebase authentication services
- Handles common authentication tasks such as logging out, refreshing tokens, and managing authentication state
- Manages the Firebase authentication listener and token refresh process
- Does not handle the actual authentication process (login, signup) which is delegated to child classes
- Interacts with Firebase authentication, AuthenticationStateService, and UserPreferencesStateService
### AuthenticationStateService
- Manages the current user's authentication state
- Stores and retrieves the user token and login method using PersistentStorageUtil
- Provides methods to get/set/clear the current user
### UserPreferencesStateService
- Manages the user's preferences and settings
- Provides methods to get/set/clear user preferences
### PersistentStorageService
- A utility class for storing and retrieving data from the browser's local storage
- Provides methods to get/set/remove the user token and login method
- Used by AuthenticationStateService to persist user state