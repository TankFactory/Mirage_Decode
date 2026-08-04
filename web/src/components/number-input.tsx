import { TextField } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from '../utils/hooks/debounce';

type NumberInputProps = {
  initValue: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  debounce?: number;
  [rest: string]: unknown;
};

export function NumberInput({ initValue, onChange, debounce = 200, min, max, ...rest }: NumberInputProps) {
  const [value, setValue] = useState(initValue.toString());
  const debouncedValue = useDebounce(value, debounce);

  const parsedValue = parseFloat(debouncedValue);
  const isValid = !isNaN(parsedValue) && (min === undefined || parsedValue >= min) && (max === undefined || parsedValue <= max);

  useEffect(() => {
    if (isValid) {
      onChange(parsedValue);
    }
  }, [isValid, parsedValue, onChange]);

  return (
    <TextField
      value={value}
      error={!isValid}
      onChange={(e) => {
        setValue(e.target.value);
      }}
      {...rest}
    />
  );
}

type NumberInputControlledProps = {
  realValue: number;
  onSubmit: (value: number) => void;
  min?: number;
  max?: number;
  debounce?: number;
  [rest: string]: unknown;
};

export function NumberInputControlled({ min, max, onSubmit, realValue, debounce = 200, ...rest }: NumberInputControlledProps) {
  const [isValid, setIsValid] = useState(true);
  const [value, setValue] = useState(realValue.toString());
  const [prevRealValue, setPrevRealValue] = useState(realValue);
  const timeoutRef = useRef<number | null>(null);

  // resync with the outside value during render rather than in an effect
  if (realValue !== prevRealValue) {
    setPrevRealValue(realValue);
    setValue(realValue.toString());
    setIsValid(true);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const parsedValue = parseFloat(newValue);
        if (!isNaN(parsedValue) && (min === undefined || parsedValue >= min) && (max === undefined || parsedValue <= max)) {
          setIsValid(true);
          onSubmit(parsedValue);
        } else {
          setIsValid(false);
        }
      }, debounce);
    },
    [min, max, onSubmit, debounce]
  );

  return <TextField value={value} error={!isValid} onChange={handleChange} {...rest} />;
}
