/**
 * Tests for StorageErrorBanner component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageErrorBanner } from '../diary/StorageErrorBanner';

describe('StorageErrorBanner', () => {
  const mockOnDismiss = vi.fn();
  const mockOnExport = vi.fn(() => '{"test": "data"}');
  const mockOnClearOldData = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should not render when no error', () => {
    const { container } = render(
      <StorageErrorBanner error={null} onDismiss={mockOnDismiss} />
    );
    expect(container.firstChild).toBeNull();
  });
  
  it('should render error message', () => {
    render(
      <StorageErrorBanner error="Test error message" onDismiss={mockOnDismiss} />
    );
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
  
  it('should call onDismiss when close button clicked', () => {
    render(
      <StorageErrorBanner error="Test error" onDismiss={mockOnDismiss} />
    );
    
    const closeButton = screen.getByLabelText('Закрыть');
    fireEvent.click(closeButton);
    
    expect(mockOnDismiss).toHaveBeenCalled();
  });
  
  it('should show quota error styling for quota errors', () => {
    render(
      <StorageErrorBanner
        error="Хранилище переполнено"
        onDismiss={mockOnDismiss}
      />
    );
    
    const heading = screen.getByRole('heading', { name: 'Хранилище переполнено' });
    const banner = heading.closest('.nd-storeerr');
    expect(banner).not.toBeNull();
    expect(banner).toHaveAttribute('role', 'alert');
  });
  
  it('should show validation error styling for validation errors', () => {
    render(
      <StorageErrorBanner
        error="Ошибка валидации данных"
        onDismiss={mockOnDismiss}
      />
    );
    
    const banner = screen.getByText('Ошибка валидации данных').closest('.nd-storeerr');
    expect(banner).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Ошибка данных' })).toBeInTheDocument();
  });
  
  it('should show storage details when toggle clicked', () => {
    render(
      <StorageErrorBanner error="Test error" onDismiss={mockOnDismiss} />
    );
    
    // Click "Детали хранилища"
    fireEvent.click(screen.getByText(/Детали хранилища/));
    
    // Should show storage info
    expect(screen.getByText(/Дней в дневнике/)).toBeInTheDocument();
  });
  
  it('should call onExport when export button clicked (quota error)', () => {
    render(
      <StorageErrorBanner
        error="Хранилище переполнено"
        onDismiss={mockOnDismiss}
        onExport={mockOnExport}
        onClearOldData={mockOnClearOldData}
      />
    );
    
    const exportButton = screen.getByText(/Экспорт и очистка/);
    fireEvent.click(exportButton);
    
    expect(mockOnExport).toHaveBeenCalled();
    expect(mockOnClearOldData).toHaveBeenCalled();
  });
  
  it('should call onClearOldData when clear button clicked', () => {
    render(
      <StorageErrorBanner
        error="Хранилище переполнено"
        onDismiss={mockOnDismiss}
        onClearOldData={mockOnClearOldData}
      />
    );
    
    const clearButton = screen.getByText(/Старше 90 дней/);
    fireEvent.click(clearButton);
    
    expect(mockOnClearOldData).toHaveBeenCalled();
  });
  
  it('should not show recovery actions for non-quota errors', () => {
    render(
      <StorageErrorBanner
        error="Ошибка валидации"
        onDismiss={mockOnDismiss}
        onExport={mockOnExport}
      />
    );
    
    expect(screen.queryByText(/Экспорт и очистка/)).not.toBeInTheDocument();
  });
});
