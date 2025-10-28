import { ColorPickerProps } from '@/types/interfaces';
import React, { useState, useEffect } from 'react';
import { ChromePicker, ColorResult } from 'react-color';

const presetColors = [
  '#ffb6b6',
  '#ffd6b6',
  '#ffe7b6',
  '#e7f0b6',
  '#c7f0b6',
  '#b6f0d6',
  '#b6f0f0',
  '#b6d6ff',
  '#b6b6ff',
  '#c7b6ff',
  '#e7b6ff',
  '#f0b6ff',
  '#ffb6f0',
  '#ffb6d6',
];

const CustomColorPicker: React.FC<ColorPickerProps> = ({
  initialColor = '#65C8D0',
  onColorChange,
  onClose,
  isOverlay = false,
}) => {
  const [color, setColor] = useState(initialColor);
  const [inputColor, setInputColor] = useState(initialColor);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setInputColor(color);
  }, [color]);

  const handleChange = (newColor: ColorResult) => {
    // Handle both hex and rgba colors
    const colorValue =
      newColor.rgb.a !== undefined && newColor.rgb.a < 1
        ? `rgba(${newColor.rgb.r}, ${newColor.rgb.g}, ${newColor.rgb.b}, ${newColor.rgb.a})`
        : newColor.hex;
    setColor(colorValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputColor(value);

    // Validate hex color or rgba color
    const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
    const rgbaRegex = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/i;

    if (hexRegex.test(value) || rgbaRegex.test(value)) {
      setColor(value);
    }
  };

  const handlePresetClick = (presetColor: string) => {
    setColor(presetColor);
    if (onColorChange) {
      onColorChange(presetColor); // Trigger the callback with the new color
    }
  };

  const handleCancel = () => {
    if (onClose) onClose();
    setIsOpen(false);
  };

  const handleApply = () => {
    if (onColorChange) onColorChange(color);
    if (onClose) onClose();
    setIsOpen(false);
  };

  // Convert color to rgba for the picker
  const getRgbaColor = (colorStr: string) => {
    if (colorStr.startsWith('rgba')) {
      return colorStr;
    }
    if (colorStr.startsWith('rgb')) {
      return colorStr.replace('rgb', 'rgba').replace(')', ', 1)');
    }
    // For hex colors, we'll let the picker handle the conversion
    return colorStr;
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg w-80 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-medium">Edit color</h3>
        <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
          ×
        </button>
      </div>

      <div className="p-4">
        <div className="mb-4">
          <ChromePicker
            key={isOverlay ? 'overlay' : 'normal'}
            color={isOverlay ? (color.startsWith('#') ? color : '#FFDE21') : getRgbaColor(color)}
            onChange={handleChange}
            disableAlpha={isOverlay}
            styles={{
              default: {
                picker: {
                  width: '100%',
                  boxShadow: 'none',
                  borderRadius: '8px',
                  background: 'transparent',
                },
              },
            }}
          />
        </div>

        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded mr-2" style={{ backgroundColor: color }} />
          <div className="flex-1">
            <input
              type="text"
              value={inputColor}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              placeholder="Enter hex (#RRGGBB) or rgba(r,g,b,a)"
            />
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-sm font-medium">Colors</p>
          <div className="grid grid-cols-7 gap-2">
            {presetColors.map((presetColor, index) => (
              <button
                key={index}
                className="w-8 h-8 rounded-full border hover:scale-110 transition-transform"
                style={{ backgroundColor: presetColor }}
                onClick={() => handlePresetClick(presetColor)}
              />
            ))}
          </div>
        </div>

        <div className="flex w-full justify-end space-x-2 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-[20px] bg-gray-100 w-[50%] hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-[14px] w-[50%] rounded-[20px] bg-black text-white hover:bg-gray-800 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomColorPicker;
