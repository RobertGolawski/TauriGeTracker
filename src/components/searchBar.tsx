import React, { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  onFocus: () => void;
}

const DEBOUNCE_DELAY = 300;

function SearchBar({ onSearch, isSearching, onFocus }: SearchBarProps) {
  const [inputValue, setInputValue] = useState<string>('');


  useEffect(() => {
    if (inputValue.trim() === '') {
      onSearch('');
      return;
    }

    const timerId = setTimeout(() => {
      onSearch(inputValue);
    }, DEBOUNCE_DELAY);

    return () => {
      console.log("SearchBar: Clearing previous timeout");
      clearTimeout(timerId);
    };
  }, [inputValue, onSearch]);


  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event?.target.value);
  };

  return (
    <div className='search-bar-container'>
      <input
        type='search'
        placeholder='Search for items...'
        value={inputValue}
        onFocus={onFocus}
        onChange={handleChange}
      />
    </div>
  );

}

export default SearchBar;
