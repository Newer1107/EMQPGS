1. Department Creation: Infinite Rendering Loop

    The Issue: When attempting to create a new department (tested with the "EXTC" department), the application entered an infinite rendering loop, causing the browser tab to freeze or crash.

    The Cause: This usually happens in React/Next.js when a state update triggers a re-render, which then immediately triggers the same state update. In this case, it's likely happening inside a useEffect hook that lacks a proper dependency array, or a function inside the submission handler is updating state incorrectly upon a successful/failed API response.

    The Fix: * Check the component where the "Create Department" form is handled.

        Inspect any useEffect hooks monitoring the department state or API response. Ensure you aren't setting state unconditionally.

        Verify the API response for adding a department isn't accidentally triggering a global context or routing loop.

2. & 3. Academic Year & Semester Architecture Overhaul

    The Issue: The current approach forces users to create semesters manually, which is inefficient and detached from how the college actually operates. Furthermore, there is no system-wide concept of the current active semester type.

    The Reality: At any given point in time, the entire college runs either an Odd Semester (Sem 1, 3, 5, 7) or an Even Semester (Sem 2, 4, 6, 8) within a specific Academic Year (e.g., 2025-2026).

    The Fix (New Approach):

        Modify Academic Year Creation: When an admin creates or configures an Academic Year, add a toggle/select option to mark the active term: Odd Semester or Even Semester.

        Automate Semesters: Remove the manual semester creation page entirely. The system should automatically know which semesters exist based on the department's duration (e.g., a 4-year B.E. program has Semesters 1 through 8).

        Depending on whether the Academic Year is set to "Odd" or "Even", the system should dynamically filter and display the relevant semesters across the platform.

4. Exam Cycle: Missing Department Names

    The Issue: When a user goes to create an Exam Cycle, the dropdown or selection list for the department names is completely empty or not visible.

    The Cause: This is a data-fetching or state-mapping bug. Either the frontend is failing to call the GET /api/departments endpoint when the Exam Cycle component mounts, or the UI component is looking for the wrong object key (e.g., trying to read dept_name instead of name from the incoming database array).

    The Fix:

        Verify that the backend endpoint for fetching departments is returning data correctly.

        Ensure the frontend component fetches this data on load (e.g., inside a useEffect).

        Check the dropdown menu component's mapping function to ensure it is binding to the correct data keys.

5. Coordinator Assignment: Data Filtering Bug & Infinite Loop

There are two distinct issues happening at the same time here:
Issue A: Missing Data Isolation (Filtering Bug)

    The Problem: When you select a specific department (like CSE) to assign a coordinator to, the system still displays faculty/coordinators belonging to other departments (like Mechanical, Civil, etc.) in the selection list.

    The Fix: You need to implement strict client-side or server-side filtering. When the department dropdown changes, it should pass that department_id to filter the faculty list so that only unassigned faculty members belonging to that specific department are displayed.

Issue B: State Crash on Assignment (Infinite Loop)

    The Problem: Even though the data isn't filtered, if you try to push through and actually assign a coordinator, the app breaks and goes into an infinite rendering loop.

    The Fix: Similar to Point 1, look at the action handler for the "Assign" button. Once the API call returns a 200 OK success status, the code that updates the UI state (or refreshes the list) is recursively triggering itself. Check your state setters and router push methods in that specific workflow.

Summary Action Items for the Dev Team:

    Fix Loops First: Debug the state/useEffect hooks on the Department Creation and Coordinator Assignment pages to stop the infinite loops.

    Fix the Data Fetching: Bind the department data to the Exam Cycle dropdown.

    Refactor the Database/Business Logic: Redesign the Academic Year schema to include an active_term (Odd/Even) enum, and delete the manual semester creation workflow. Use code logic to handle semesters instead.