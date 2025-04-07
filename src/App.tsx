import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css"; // Assuming you have some basic CSS

// 1. Define the ItemData interface matching your Rust struct
// Ensure this matches the fields returned by load_initial_data
interface ItemData {
  id: number; // Use number for u32
  name: string;
  examine: string;
  members: boolean;
  lowalch: number;
  highalch: number;
  limit?: number; // Use optional if it's Option<u32> in Rust or might be missing
  // Add icon if you included it: icon?: string;
}

function App() {
  // 2. State variables
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading
  const [error, setError] = useState<string | null>(null);
  const [trackedItems, setTrackedItems] = useState<ItemData[]>([]); // To hold the result

  // 3. useEffect to call the command on component mount
  useEffect(() => {
    console.log("Frontend: Attempting to invoke 'load_initial_data'...");
    invoke<ItemData[]>("load_initial_data") // Specify the expected return type
      .then((result) => {
        console.log("Frontend: Successfully received data:", result);
        setTrackedItems(result); // Store the returned tracked items
        setError(null); // Clear any previous errors
      })
      .catch((err) => {
        console.error("Frontend: Error invoking 'load_initial_data':", err);
        setError(
          typeof err === "string" ? err : "An unknown error occurred",
        ); // Store the error message
        setTrackedItems([]); // Clear items on error
      })
      .finally(() => {
        setIsLoading(false); // Stop loading indicator regardless of success/failure
      });
  }, []); // Empty dependency array means this runs only once on mount

  // 4. Render based on state
  return (
    <div className="container">
      <h1>OSRS GE Tracker - Initial Load Test</h1>

      {isLoading && <p>Loading initial data from backend...</p>}

      {error && (
        <div style={{ color: "red", border: "1px solid red", padding: "10px" }}>
          <h2>Error Loading Data:</h2>
          <pre>{error}</pre>
          <p>
            Check the console (View . Toggle Developer Tools in Tauri app) and
            the terminal where you ran `npm run tauri dev` for more details.
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <div>
          <h2>Initial Tracked Items Loaded:</h2>
          {trackedItems.length > 0 ? (
            <ul>
              {trackedItems.map((item) => (
                <li key={item.id}>
                  <strong>ID:</strong> {item.id} <br />
                  <strong>Name:</strong> {item.name} <br />
                  <strong>Examine:</strong> {item.examine} <br />
                  {/* Add other fields if desired */}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No tracked items found (or the tracked_ids.json file is empty or
              missing).
            </p>
          )}
          <p>
            (Backend should have also loaded/fetched the full item cache in the
            background)
          </p>
        </div>
      )}
    </div>
  );
}

export default App;



// import { useState } from "react";
// import reactLogo from "./assets/react.svg";
// import { invoke } from "@tauri-apps/api/core";
// import "./App.css";
//
// function App() {
//   const [greetMsg, setGreetMsg] = useState("");
//   const [name, setName] = useState("");
//
//   async function greet() {
//     // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//     setGreetMsg(await invoke("greet", { name }));
//   }
//
//   return (
//     <main className="container">
//       <h1>Welcome to Tauri + React</h1>
//
//       <div className="row">
//         <a href="https://vitejs.dev" target="_blank">
//           <img src="/vite.svg" className="logo vite" alt="Vite logo" />
//         </a>
//         <a href="https://tauri.app" target="_blank">
//           <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
//         </a>
//         <a href="https://reactjs.org" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <p>Click on the Tauri, Vite, and React logos to learn more.</p>
//
//       <form
//         className="row"
//         onSubmit={(e) => {
//           e.preventDefault();
//           greet();
//         }}
//       >
//         <input
//           id="greet-input"
//           onChange={(e) => setName(e.currentTarget.value)}
//           placeholder="Enter a name..."
//         />
//         <button type="submit">Greet</button>
//       </form>
//       <p>{greetMsg}</p>
//     </main>
//   );
// }
//
// export default App;
