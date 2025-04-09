import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css"; // Assuming you have some basic CSS
import SearchBar from "./components/searchBar";
import { resolve } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";

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

interface ItemPriceData {
  high: number;
  low: number;
  high_time?: string | null;
  low_time?: string | null;
}

interface PriceUpdatePayload {
  prices: Record<string, ItemPriceData>;
}

function App() {
  // 2. State variables
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading
  const [error, setError] = useState<string | null>(null);
  const [trackedItems, setTrackedItems] = useState<ItemData[]>([]); // To hold the result
  const [currentPrices, setCurrentPrices] = useState<Record<string, ItemPriceData>>({});
  const [searchResults, setSearchResults] = useState<ItemData[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const handleSearch = async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await invoke<ItemData[]>("search_items", { query: trimmedQuery });
      console.log("App: Received results: ", res);
      setSearchResults(res);
      // await new Promise(resolve => setTimeout(resolve, 500));
      // const fakeResults: ItemData[] = [
      //   { id: 1, name: `${trimmedQuery} Result 1`, examine: 'Fake', members: true, lowalch: 1, highalch: 1 },
      //   { id: 2, name: `${trimmedQuery} Result 2`, examine: 'Fake', members: false, lowalch: 1, highalch: 1 },
      // ]
      // setSearchResults(fakeResults);
    }
    catch (err) {
      console.log("App: Search failed", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }


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


  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupPriceListener = async () => {
      try {
        unlistenFn = await listen<PriceUpdatePayload>("prices-updated", (event) => {
          console.log("App: Received prices-updated event", event.payload);

          setCurrentPrices(prevPrices => {
            const updatedPrices = {
              ...prevPrices,
              ...event.payload.prices,
            };
            console.log("App: Updated prices state: ", updatedPrices);
            return updatedPrices;
          })
        })
      } catch (error) {
        console.error("App: Failed to attach price listener: ", error);
      }
    };
    setupPriceListener();

    return () => {
      console.log("App: Cleaning up price listener...");
      if (unlistenFn) {
        unlistenFn();
        console.log("App: Price listener detached.");
      }
    };
  }, []);

  // 4. Render based on state
  return (<div className="app-container">
    <SearchBar onSearch={handleSearch} isSearching={isSearching} />
    <ul>
      {searchResults.map(item => (
        <li key={item.id}>{item.name} (ID: {item.id})</li>
      ))}
    </ul>
  </div>
  );
}

export default App;



// <div className="container">
//   <h1>OSRS GE Tracker - Initial Load Test</h1>
//
//   {isLoading && <p>Loading initial data from backend...</p>}
//
//   {error && (
//     <div style={{ color: "red", border: "1px solid red", padding: "10px" }}>
//       <h2>Error Loading Data:</h2>
//       <pre>{error}</pre>
//       <p>
//         Check the console (View . Toggle Developer Tools in Tauri app) and
//         the terminal where you ran `npm run tauri dev` for more details.
//       </p>
//     </div>
//   )}
//
//   {!isLoading && !error && (
//     <div>
//       <h2>Initial Tracked Items Loaded:</h2>
//       {trackedItems.length > 0 ? (
//         <ul>
//           {trackedItems.map((item) => (
//             <li key={item.id}>
//               <strong>ID:</strong> {item.id} <br />
//               <strong>Name:</strong> {item.name} <br />
//               <strong>Examine:</strong> {item.examine} <br />
//               {/* Add other fields if desired */}
//             </li>
//           ))}
//         </ul>
//       ) : (
//         <p>
//           No tracked items found (or the tracked_ids.json file is empty or
//           missing).
//         </p>
//       )}
//       <p>
//         (Backend should have also loaded/fetched the full item cache in the
//         background)
//       </p>
//     </div>
//   )}
// </div>

