/**
 * Tests for FrequentFoodsPanel component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrequentFoodsPanel } from '../diary/FrequentFoodsPanel';
import { useFrequentFoods } from '../useNutritionDiary';

// Mock the hook
vi.mock('../useNutritionDiary', () => ({
  useFrequentFoods: vi.fn(),
}));

describe('FrequentFoodsPanel', () => {
  const mockOnAddFood = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should not render when no frequent foods', () => {
    (useFrequentFoods as jest.Mock).mockReturnValue([]);
    
    const { container } = render(
      <FrequentFoodsPanel diary={{}} onAddFood={mockOnAddFood} />
    );
    
    expect(container.firstChild).toBeNull();
  });
  
  it('should render frequent foods', () => {
    const mockFoods = [
      { name: 'Chicken Breast', kcal: 165, p: 31, f: 3.6, c: 0, qty: 100 },
      { name: 'Eggs', kcal: 150, p: 12, f: 10, c: 1, qty: 100 },
    ];
    (useFrequentFoods as jest.Mock).mockReturnValue(mockFoods);
    
    render(<FrequentFoodsPanel diary={{}} onAddFood={mockOnAddFood} />);
    
    expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
    expect(screen.getByText('Eggs')).toBeInTheDocument();
  });
  
  it('should call onAddFood when food button clicked', () => {
    const mockFoods = [
      { name: 'Chicken Breast', kcal: 165, p: 31, f: 3.6, c: 0, qty: 100 },
    ];
    (useFrequentFoods as jest.Mock).mockReturnValue(mockFoods);
    
    render(<FrequentFoodsPanel diary={{}} onAddFood={mockOnAddFood} />);
    
    const foodButton = screen.getByText('Chicken Breast');
    fireEvent.click(foodButton);
    
    expect(mockOnAddFood).toHaveBeenCalledWith(
      mockFoods[0],
      'Перекус' // default meal type
    );
  });
  
  it('should change meal type when selector clicked', () => {
    const mockFoods = [
      { name: 'Chicken Breast', kcal: 165, p: 31, f: 3.6, c: 0, qty: 100 },
    ];
    (useFrequentFoods as jest.Mock).mockReturnValue(mockFoods);
    
    render(<FrequentFoodsPanel diary={{}} onAddFood={mockOnAddFood} />);
    
    // Click on "Обед" meal type
    const obedButton = screen.getByText('Обед');
    fireEvent.click(obedButton);
    
    // Now click food button
    const foodButton = screen.getByText('Chicken Breast');
    fireEvent.click(foodButton);
    
    expect(mockOnAddFood).toHaveBeenCalledWith(
      mockFoods[0],
      'Обед'
    );
  });
  
  it('should show/hide all foods when toggle clicked', () => {
    const mockFoods = Array(15).fill(null).map((_, i) => ({
      name: `Food ${i}`,
      kcal: 100,
      p: 10,
      f: 5,
      c: 10,
      qty: 100,
    }));
    (useFrequentFoods as jest.Mock).mockReturnValue(mockFoods);
    
    render(<FrequentFoodsPanel diary={{}} onAddFood={mockOnAddFood} maxItems={10} />);
    
    // Should show "Показать все" button
    expect(screen.getByText('Показать все')).toBeInTheDocument();
    
    // Click to show all
    fireEvent.click(screen.getByText('Показать все'));
    
    // Should now show "Скрыть"
    expect(screen.getByText('Скрыть')).toBeInTheDocument();
  });
  
  it('should display food nutrition info', () => {
    const mockFoods = [
      { name: 'Chicken Breast', kcal: 165, p: 31, f: 3.6, c: 0, qty: 100 },
    ];
    (useFrequentFoods as jest.Mock).mockReturnValue(mockFoods);
    
    render(<FrequentFoodsPanel diary={{}} onAddFood={mockOnAddFood} />);
    
    expect(screen.getByText('165 ккал')).toBeInTheDocument();
    expect(screen.getByText('Б31 Ж3.6 У0')).toBeInTheDocument();
  });
});
