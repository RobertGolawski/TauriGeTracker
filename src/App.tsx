import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import SearchBar from "./components/searchBar";
import { listen } from "@tauri-apps/api/event";
import SearchList from "./components/searchList";
import ItemDetail from "./components/itemDetail";
import TrackedItemsDisplay from "./components/trackedItemsDisplay";


interface ItemData {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch: number;
  highalch: number;
  limit?: number;
  // Add icon if you included it: icon?: string;
}

interface ItemPriceData {
  high: number;
  low: number;
  highTime?: string | null;
  lowTime?: string | null;
}

interface PriceUpdatePayload {
  prices: Record<string, ItemPriceData>;
}

function App() {
  const [trackedItems, setTrackedItems] = useState<ItemData[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, ItemPriceData>>({});
  const [searchResults, setSearchResults] = useState<ItemData[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<String>('');
  const [selectedItemDetail, setSelectedItemDetail] = useState<ItemData | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false)
        console.log("App: Clicked outside search, hiding list.");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = useCallback(async (query: string) => {
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
      setSearchQuery(trimmedQuery)
      setSearchResults(res);
    }
    catch (err) {
      console.log("App: Search failed", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);


  const handleSearchResultSelected = (item: ItemData) => {

    handleShowDetails(item);
    console.log("App: Search result selected: ", item);
    setSearchResults([]);
    setSearchQuery('');

    setIsSearchFocused(false);
  }

  const handleSearchFocus = () => {
    console.log("App: Focused");
    setIsSearchFocused(true);
  }

  const handleAdd = async (id: number) => {
    if (trackedItems.some(item => item.id === id)) {
      return;
    }

    try {
      const res = await invoke<void>("add_tracked_item", { id: id });
      console.log("App: Result of add: ", res);

      if (selectedItemDetail && selectedItemDetail.id === id) {
        setTrackedItems(currentTracked => [...currentTracked, selectedItemDetail]);
      } else {
        console.warn("App: Added item not currently selected, might need refresh");
      }
    }
    catch (err) {
      console.error("App: Error tracking item: ", err);
    }
  }

  const handleDel = async (id: number) => {
    try {
      const res = await invoke<void>("del_tracked_item", { idToDel: id });
      console.log("App: Result of del: ", res);

      setTrackedItems(currentTracked => currentTracked.filter(item => item.id !== id));
    }
    catch (err) {
      console.error("App: Error deleting tracked item: ", err);
    }
  }

  const handleShowDetails = (item: ItemData) => {
    console.log("App: Showing details for: ", item.name);
    setSelectedItemDetail(item);
  }

  const handleCloseDetailModal = () => {
    console.log("App: Closing details modal");
    setSelectedItemDetail(null);
  }

  useEffect(() => {
    console.log("Frontend: Attempting to invoke 'load_initial_data'...");
    invoke<ItemData[]>("load_initial_data")
      .then((result) => {
        console.log("Frontend: Successfully received data:", result);
        setTrackedItems(result);
      })
      .catch((err) => {
        console.error("Frontend: Error invoking 'load_initial_data':", err);

        setTrackedItems([]);
      })
  }, []);

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

  const handleManualRefresh = async () => {
    try {
      let res = await invoke<void>("manual_price_refresh");
      console.log("App: Manual refresh response: ", res);
    } catch (err) {
      console.error("App: Problem with manual refresh: ", err);
    }
  }

  const showSearchList = isSearchFocused && searchQuery.length > 0;

  return (<div className="app-container">
    <div ref={searchContainerRef} className="search-container">
      <SearchBar onSearch={handleSearch} onFocus={handleSearchFocus} />

      {showSearchList ? <SearchList
        results={searchResults}
        onItemSelected={handleSearchResultSelected}
      /> : null}
    </div>
    <button onClick={handleManualRefresh}>Refresh Prices Manually</button>
    <TrackedItemsDisplay
      items={trackedItems}
      prices={currentPrices}
      onShowDetails={handleShowDetails}
      onRemoveItem={handleDel} />

    {selectedItemDetail && (
      <ItemDetail
        item={selectedItemDetail}
        onClose={handleCloseDetailModal}
        onAdd={handleAdd}
        onDel={handleDel}
        isTracked={trackedItems.some(tracked => tracked.id === selectedItemDetail.id)}
      />
    )}
  </div>
  );
}

export default App;


