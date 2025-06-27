# PicStack Local

An intelligent, local-first photo organizer powered by Next.js and Google AI.

## Overview

PicStack Local is a web application designed for users who want to manage their photo libraries with complete privacy and control. All data, including images and metadata, is stored directly in the user's browser using IndexedDB, ensuring no data is ever uploaded to a central server. The app leverages the power of Google's Gemini AI via Genkit to provide intelligent features like automatic tagging and description generation, all initiated on-demand by the user.

## Key Features (User Perspective)

-   **100% Local Storage:** Your photos, collections, and metadata stay on your device, ensuring privacy and offline access.
-   **AI-Powered Analysis:** Generate descriptive tags and detailed summaries for your images with a single click, using Google's Gemini model via Genkit.
-   **Hierarchical Collections:** Organize photos into nested folders for precise categorization.
-   **Powerful Search & Filtering:** Quickly find images by name, tag, or collection. Use special filters to find untagged, undescribed, unassigned images, or potential duplicates.
-   **Bulk Operations:** Efficiently process multiple images at once to add them to collections or generate AI metadata.
-   **Image Management:** Favorite, protect, rotate, resize, and rename your images directly in the app.
-   **Data Portability:** Export your entire library (images + metadata) as a ZIP or a single JSON file for easy backup or migration. Import data just as easily.
-   **Customizable Interface:** Switch between light and dark modes, and adjust the number of columns and images displayed per page.
-   **Library Statistics:** Get a quick overview of your library with an analytics modal showing total images and counts per collection.

## Technical Stack & Architecture

-   **Framework:** **Next.js 15** (App Router) with **React** and **TypeScript**.
-   **Styling:** **Tailwind CSS** with a custom theme using CSS variables. UI components are built with **ShadCN UI** and icons from **Lucide React**.
-   **Local Database:** **IndexedDB** is the core of the local-first approach, managed by the powerful wrapper **`Dexie.js`**. It stores all image blobs, collections, and metadata.
-   **AI Integration:** **`Genkit`** is used to define and manage server-side flows that interact with the **Google AI (Gemini) API**. This architecture keeps API keys and complex logic securely on the server-side.
-   **State Management:** Primarily uses React's built-in hooks (`useState`, `useCallback`) and reactive queries from `dexie-react-hooks` to keep the UI in sync with the local database.
-   **Theming:** **`next-themes`** handles the theme switching logic for light, dark, and system preferences.

## Getting Started

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up your environment variables:**
    -   Create a file named `.env` in the root of the project.
    -   Add your Google AI API Key to this file. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).
    ```
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:9002](http://localhost:9002) in your browser to see the application.

## Project Structure

-   **/src/app**: Main pages, layout, and global styles for the Next.js App Router.
-   **/src/components**: Reusable React components, organized by feature (e.g., `image`, `collections`) and `ui` for ShadCN components.
-   **/src/lib**: Core application logic, including database setup and operations (`db.ts`) and utility functions.
-   **/src/ai**: Contains all Genkit-related code, including flows for interacting with the Google AI API.
-   **/src/hooks**: Custom React hooks used throughout the application.
