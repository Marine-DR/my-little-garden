# Package structure

This project is a multi apps project. Goal is to share a core package with business rules to multiples apps all sharing at least the same technology.
Following this principle, there is:

- core package expected to contains domain models, business rules
- communication package expected to handle import and export of files, data
- database as we will use SQL langage, or a toolkit that encapsulate it
- apps folder that will contain
  - desktop app
  - mobile app
  - web app

## Core package

This is the more important package as it contains all domains and rules to make the apps work the same whatever the deployment.
When needed, it relies on interfaces to delegate implementation one level higher.

## Communication package

It handles all formats of import and export. It is separated from the core package as it will not be deployed in all apps.

## Database package

It contains all the implementation for the interfaces from Core that manipulate models.

## Apps package

This is the folder for all apps

### Desktop

This is the first implementation, it use core, communication and database package to provide a standalone offline experience.
Chosen implementation is Electron.

### Mobile

Will come later.

### Web

Will come later.
