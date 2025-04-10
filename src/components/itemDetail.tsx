import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface ItemData {
  id: number; name: string;
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


interface ItemDetailProps {
  item: ItemData;
  isTracked: boolean;
  onAdd: (id: number) => void;
  onDel: (id: number) => void;
  onClose: () => void;
}

function ItemDetail({ item, isTracked, onAdd, onDel, onClose }: ItemDetailProps) {

  const [priceData, setPriceData] = useState<ItemPriceData | null>(null);

  useEffect(() => {
    setPriceData(null);

    const fetchPrice = async () => {
      try {
        const res = await invoke<ItemPriceData>("fetch_search_item", { id: item.id });
        setPriceData(res);

      } catch (err) {
        console.error("Modal: Failed to fetch price data: ", err);
      }
    };
    fetchPrice();
  }, [item.id]);


  console.log("ItemDetailModal rendering, priceData state:", priceData);
  const formatTimestamp = (timestampSeconds: string | null | undefined): string => {
    if (timestampSeconds === null || timestampSeconds === undefined) {
      return 'N/A';
    }
    try {
      const date = new Date(+timestampSeconds * 1000);
      if (isNaN(date.getTime())) {
        console.warn("formatTimestamp: Invalid date created from timestamp:", timestampSeconds);
        return "Invalid Date";
      }
      return date.toLocaleString();
    } catch (error) {
      console.error("formatTimestamp error:", error);
      return "Error";
    }
  };

  const handleAddClick = () => {
    onAdd(item.id);
  }

  const handleDelClick = () => {
    onDel(item.id);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>X</button>

        <h2>{item.name} (ID: {item.id})</h2>
        <p><i>{item.examine || "No examine text available."}</i></p>
        <p>Members Only: {item.members ? 'Yes' : 'No'}</p>
        <p>High Alch: {item.highalch ?? 'N/A'}</p>         <p>Low Alch: {item.lowalch ?? 'N/A'}</p>
        <p>Limit: {item.limit ?? 'N/A'}</p>

        <h3>Price Data:</h3>
        {priceData && (
          <>
            <p>High: {priceData.high?.toLocaleString() ?? 'N/A'}</p>
            <p>Low: {priceData.low?.toLocaleString() ?? 'N/A'}</p>
            <p>High Time: {formatTimestamp(priceData.highTime)}</p>
            <p>Low Time: {formatTimestamp(priceData.lowTime)}</p>
          </>
        )}

        <div className="modal-actions">
          {isTracked ? (
            <button onClick={handleDelClick} className="button-remove">Remove from Tracked</button>
          ) : (
            <button onClick={handleAddClick} className="button-add">Add to Tracked</button>
          )}
        </div>

      </div>
    </div>
  );
}

export default ItemDetail;
