# AppVote Portal

A stylish web application for submitting and voting on apps, built with React and Supabase.

## Features

- 👥 User authentication with email alias support
- 🎨 Clean and responsive UI with orange, white, and brown theme
- 📱 App submission with preview image upload
- 📊 Voting system (up to 5 votes per user)
- 🛡️ Anonymous voting (submitter hidden except for admin)
- 📈 Admin dashboard with sharing capabilities

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Set up the following resources in your Supabase project:

#### Database Tables

Run the SQL commands found in `supabase_setup.sql` in the SQL Editor of your Supabase project.

#### Storage Bucket Setup

1. In the Supabase dashboard, navigate to the Storage section
2. Create a new bucket named "app_images"
3. Configure the bucket settings:
   - Enable "Public bucket" option (for image display)
   - Set appropriate RLS policies:
     - Allow authenticated users to upload
     - Allow users to update/delete their own files
     - Allow public read access

> ⚠️ **Important**: Storage buckets **cannot** be created using the SQL script or client SDK with anon credentials. You must create them manually through the Supabase dashboard. See `SUPABASE_STORAGE_SETUP.md` for detailed instructions on setting up the `app_images` bucket.

### 2. Environment Variables

1. Copy the `.env.example` file to a new file named `.env` in the project root
2. Fill in your Supabase credentials:
   ```
   REACT_APP_SUPABASE_URL=your_project_url
   REACT_APP_SUPABASE_ANON_KEY=your_anon_key
   ```

### 3. Local Development

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm start
```

Build for production:
```bash
npm run build
```

## User Roles and Permissions

### Regular Users
- Register/login with email aliases (+1 support)
- Submit apps with preview images
- Vote for up to 5 apps
- Cannot vote for their own apps
- Cannot see who submitted other apps

### Admin
- Full visibility of submitter information
- Access to admin dashboard
- View app ranking and vote counts
- Share top 10 list with others
- Export data to CSV

## Styling

The application uses a custom theme with:
- Primary color: Orange (#E87A41)
- Secondary colors: White (#FFFFFF) and Brown (#8B4513)
- Dark backgrounds with light text for contrast
- Responsive layout for all device sizes

## Dependencies

- React
- React Router DOM
- React Hook Form
- Supabase JS Client
- React Toastify
- UUID
- React Icons
