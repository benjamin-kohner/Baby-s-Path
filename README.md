# Baby's Path

Baby's Path is a comprehensive developmental milestone tracker designed to help parents and caregivers monitor their baby's growth and progress over time. 

## Features

- **Milestone Tracking:** Keep track of your baby's Athletic, Cognitive, Social, and Fine Motor skills step-by-step from 6 months up to 24 months of age.
- **Family Sync:** Securely sync your baby's milestones across devices so parents, grandparents, and caregivers can stay up-to-date.
- **Dynamic Age Calculation:** Enter your baby's birth date, and the app automatically tailors recommended activities and checklists to their exact developmental stage.
- **Daily Checklist & Goals:** Manage everyday developmental activities via intuitive checklists and monitor long-term goals for upcoming months.
- **Progress Insights:** Visual tracking helps you see exactly how your baby is progressing on their developmental journey.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Backend/Database:** Firebase Firestore
- **Authentication:** Firebase Auth

## Live App
You can use the live, hosted version of this application on Google Cloud Run here:
[Baby's Path - Live App](https://baby-s-path-82373469617.us-west1.run.app)

## Getting Started

1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your Firebase environment variables based on the `.env.example` file:
   ```bash
   cp .env.example .env
   # Add your Firebase credentials to the .env file
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
