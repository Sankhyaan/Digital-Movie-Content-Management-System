# Digital Movie Content Management System (CineVerse)

The Digital Movie Content Management System is a full-stack web application developed to efficiently store, organize, and retrieve structured information related to movies and television series. The project is built using a combination of Node.js and Express for the backend, React for the frontend, and MySQL as the relational database. It demonstrates how database systems can be integrated with modern web technologies to create a complete data-driven application.

The system is designed around a well-structured relational database that maintains detailed information about content such as titles, release year, type (movie or series), genres, languages, actors, and OTT platforms. For television series, additional hierarchical data such as seasons and episodes are also stored, allowing the system to represent real-world content relationships effectively. The database is normalized to reduce redundancy and ensure data consistency, with several many-to-many relationships handled through junction tables like `content_actor`, `content_genre`, `content_language`, and `content_platform`.

On the backend, Node.js and Express are used to create RESTful API endpoints that interact with the database. These endpoints allow the frontend to fetch and display data dynamically, such as retrieving all content, filtering by genre or platform, or viewing detailed information about a specific movie or series. The backend also ensures efficient query execution and proper handling of relational data using SQL joins and conditions.

The frontend is built using React, providing a modern and responsive user interface. It allows users to browse through a list of movies and series, search for specific titles, and view additional details such as actors, genres, and platform availability. The interface is designed to be intuitive and visually appealing, making it easy to explore the data stored in the system.

In addition to basic database operations, the project incorporates advanced DBMS features such as triggers, stored procedures, functions, cursors, and transactions. These features help automate tasks, enforce data integrity, perform calculations, and ensure reliable data operations. Views and indexing are also used to improve query performance and simplify data retrieval.

Overall, this project demonstrates the practical implementation of database management concepts along with full-stack development. It highlights how structured data can be effectively managed and presented through a web application, making it a comprehensive example of a modern database-driven system.

---

## 🚀 Features

- **Dynamic Content Explorer**: Browse movies and TV series with responsive "Black & Emerald Green" modern aesthetics, glassmorphism UI, and detailed viewing cards.
- **Advanced Relational Database**: Highly normalized MySQL schema separating content metadata from relations (actors, genres, platforms, languages) via junction tables.
- **Search & Filtering**: Real-time filtering by genre, language, type, and search queries, executed efficiently across multiple database joins.
- **Hierarchical TV Series Data**: Structurally nested seasons and episodes mapped cleanly to the UI.
- **Advanced DBMS Implementations**: Utilizes stored procedures, triggers, and cursors to guarantee database integrity and automate backend logic.

## 🎯 Novelty - Content Recommendation

• Uses a MySQL Stored Procedure for recommendations.
• Filters content by genre, type, duration, era, and rating directly in SQL.
• Results ranked by rating using multi-table JOINs inside the database.
• A 4-question quiz on the frontend maps user choices to SQL parameters.
• Returns up to 10 personalised matches in real time.
• Preference-based, not history-based — no user tracking needed.
• Proves stored procedures can power smart features beyond just data storage.

## 🛠️ Technology Stack

- **Frontend**: React.js, React-Router-DOM, CSS
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MySQL (accessed via `mysql2/promise`)
- **Architecture**: Repository Pattern, RESTful API

## 🗄️References and URL's

1. Node.js Documentation - https://nodejs.org/en/docs
2. Express.js Documentation - https://expressjs.com/
3. React Documentation - https://react.dev/
4. W3Schools SQL & Web Tutorials - https://www.w3schools.com/
5. GeeksforGeeks (DBMS and SQL concepts) - https://www.geeksforgeeks.org/

## 💻 Quick Start Setup

### Prerequisites

- Node.js 18+
- MySQL Server

### 1. Database Setup

1. Create a MySQL database named `project`.
2. Import the schema and data:

```bash
mysql -u root -p project < backend/schema.sql
```

### 2. Backend Initialization

```bash
cd backend
npm install
# Ensure you have a .env file configured with your DB credentials (DB_USER, DB_PASSWORD, etc.)
npm run dev
```

The backend API will run on `http://localhost:5000`.

### 3. Frontend Initialization

```bash
cd frontend
npm install
npm run dev
```

The frontend application will launch at `http://localhost:5173`.
