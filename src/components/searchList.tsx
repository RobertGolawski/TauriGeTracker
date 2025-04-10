
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

interface SearchListProps {
  results: ItemData[];
  onItemSelected: (item: ItemData) => void;
}

function SearchList({ results, onItemSelected }: SearchListProps) {


  if (results.length === 0) {
    return (
      <div className="search-list search-list-empty">
        <p> No items found. </p>
      </div>
    );
  }

  return (
    <div className="search-list" style={{
      color: "red",
      border: "2px dashed blue", // Example with different border style
      borderRadius: "5px", // Optional: Rounded corners
      padding: "15px"
    }}>
      <ul>
        {results.map((item) => (
          <li
            key={item.id}
            onClick={() => onItemSelected(item)}
            className="search-list-item"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onItemSelected(item); }}>
            {item.name} (ID: {item.id})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SearchList;
