
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
    <div className="search-list" >
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
