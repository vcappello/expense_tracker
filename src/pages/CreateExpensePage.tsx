import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseType } from '../types';
import { sortAccountsPreferred } from '../utils/accounts';
import {
  ONLINE_LOCATION_VALUE,
  PlaceCategoryMetadata,
  suggestExpenseTypeForLocation,
} from '../utils/locationCategories';
import {
  Coordinates,
  isWithinHomeRadius,
  loadHomeLocation,
} from '../utils/homeLocation';
import { useNavigateBack } from '../utils/navigation';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon, LocateIcon } from '../components/icons';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import '../styles/ExpenseForm.css';
import { v4 as uuidv4 } from 'uuid';

const formatTimeToHHMMSS = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

interface LocationSuggestion {
  label: string;
  category?: string;
  type?: string;
}

type LocationSearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getPhotonSuggestions = (payload: unknown): LocationSuggestion[] => {
  if (!isRecord(payload) || !Array.isArray(payload.features)) {
    throw new Error('Invalid Photon response');
  }

  const labels = new Set<string>();
  return payload.features.flatMap((feature: unknown) => {
    if (!isRecord(feature) || !isRecord(feature.properties)) return [];

    const properties = feature.properties;
    const get = (key: string): string =>
      typeof properties[key] === 'string' ? properties[key].trim() : '';
    const locality = get('city') || get('locality');
    const streetAddress = [get('street'), get('housenumber')]
      .filter(Boolean)
      .join(' ');
    const county = locality ? '' : get('county');
    const parts = [
      get('name'),
      streetAddress,
      [get('postcode'), locality].filter(Boolean).join(' '),
      get('district'),
      county,
      get('state'),
      get('country'),
    ].filter(Boolean);
    const label = parts.filter(
      (part, index) =>
        parts.findIndex(
          (candidate) =>
            candidate.toLocaleLowerCase() === part.toLocaleLowerCase()
        ) === index
    ).join(', ');
    const normalizedLabel = label.toLocaleLowerCase();

    if (!label || labels.has(normalizedLabel)) return [];
    labels.add(normalizedLabel);
    return [{
      label,
      category: typeof properties.osm_key === 'string' ? properties.osm_key : undefined,
      type: typeof properties.osm_value === 'string' ? properties.osm_value : undefined,
    }];
  });
};

export default function CreateExpensePage() {
  const navigateBack = useNavigateBack('/');
  const { id: expenseId } = useParams<{ id: string }>();
  const {
    accounts,
    expenseTypes,
    expenses,
    loadExpenses,
    createExpenseType,
    getExpense,
    deleteExpense,
    saveExpenseWithCoins,
    getCashflows,
  } = useApp();
  const sortedAccounts = sortAccountsPreferred(accounts);
  const coinAccounts = sortedAccounts.filter((a) => a.isCoinAccount);

  const now = new Date();
  const [formData, setFormData] = useState({
    date: now.toISOString().split('T')[0],
    time: formatTimeToHHMMSS(now),
    amount: '',
    expenseTypeId: '',
    accountId: sortedAccounts[0]?.id || '',
    coinsAccountId: '',
    coinsAmount: '',
    notes: '',
    location: '',
    reimbursable: false,
  });

  const [expenseTypeSearch, setExpenseTypeSearch] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [expenseHistoryLoaded, setExpenseHistoryLoaded] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationSearchStatus, setLocationSearchStatus] =
    useState<LocationSearchStatus>('idle');
  const [activeLocationSuggestion, setActiveLocationSuggestion] = useState(-1);
  const [locationMetadata, setLocationMetadata] =
    useState<PlaceCategoryMetadata>({});
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsRequestIdRef = useRef(0);
  const reverseGeocodeControllerRef = useRef<AbortController | null>(null);
  const homeLocationRef = useRef<Coordinates | null>(null);
  const categorySelectionOriginRef = useRef<'manual' | 'location' | null>(
    expenseId ? 'manual' : null
  );
  const locationSuggestionsOpen =
    locationSearchQuery.trim().length >= 3 && locationSearchStatus !== 'idle';
  const isOnlineLocation = formData.location === ONLINE_LOCATION_VALUE;
  const suggestedExpenseType = useMemo(
    () =>
      suggestExpenseTypeForLocation(
        formData.location,
        locationMetadata,
        expenses,
        expenseTypes,
        expenseId
      ),
    [formData.location, locationMetadata, expenses, expenseTypes, expenseId]
  );

  useEffect(() => {
    let active = true;
    loadExpenses().finally(() => {
      if (active) setExpenseHistoryLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [loadExpenses]);

  useEffect(() => {
    const query = locationSearchQuery.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setLocationSearchStatus('idle');
      setActiveLocationSuggestion(-1);
      return;
    }

    setLocationSuggestions([]);
    setLocationSearchStatus('idle');
    setActiveLocationSuggestion(-1);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLocationSearchStatus('loading');
      try {
        const params = new URLSearchParams({ q: query, lang: 'default', limit: '5' });
        const response = await fetch(
          `https://photon.komoot.io/api/?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Photon request failed with status ${response.status}`);
        }

        const suggestions = getPhotonSuggestions(await response.json());
        if (!controller.signal.aborted) {
          setLocationSuggestions(suggestions);
          setLocationSearchStatus(suggestions.length > 0 ? 'results' : 'empty');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Place search failed:', error);
          setLocationSuggestions([]);
          setLocationSearchStatus('error');
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [locationSearchQuery]);

  useEffect(() => {
    const loadExpense = async () => {
      if (expenseId) {
        try {
          const expense = await getExpense(expenseId);
          if (expense) {
            categorySelectionOriginRef.current = 'manual';
            // Pre-fill the coin-split fields (if any) from the linked group:
            // the internal income is the positive Cashflow with the same
            // routingPairId and no routingAccountId.
            let coinsAccountId = '';
            let coinsAmount = '';
            if (expense.routingPairId) {
              const all = await getCashflows();
              const income = all.find(
                (c) =>
                  c.routingPairId === expense.routingPairId &&
                  c.routingAccountId === null &&
                  c.amount > 0
              );
              if (income) {
                coinsAccountId = income.accountId;
                coinsAmount = Math.abs(income.amount).toString();
              }
            }
            setFormData({
              date: expense.date.toISOString().split('T')[0],
              time: expense.time || formatTimeToHHMMSS(new Date()),
              amount: Math.abs(expense.amount).toString(),
              expenseTypeId: expense.expenseTypeId,
              accountId: expense.accountId,
              coinsAccountId,
              coinsAmount,
              notes: expense.notes ?? '',
              location: expense.location ?? '',
              reimbursable: expense.reimbursable === true,
            });
          }
        } catch (err) {
          console.error('Failed to load expense:', err);
        }
      }
    };
    
    loadExpense();
  }, [expenseId, getExpense, getCashflows]);

  // Update default account when accounts change
  useEffect(() => {
    if (!formData.accountId && accounts.length > 0) {
      setFormData((prev) => ({
        ...prev,
        accountId: sortedAccounts[0].id,
      }));
    }
  }, [accounts]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show a transient toast (default success ✅, pass ⚠️ for warnings), resetting any pending timer
  const showToast = (message: string, icon = '✅') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, icon });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    try {
      const savedHomeLocation = loadHomeLocation();
      homeLocationRef.current = savedHomeLocation;
    } catch (err) {
      console.error('Failed to load home location:', err);
      showToast('Posizione casa salvata non valida; puoi impostarla di nuovo', '⚠️');
    }
  }, []);

  // Clear the toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      date: e.target.value,
    }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      time: e.target.value,
    }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        amount: value,
      }));
    }
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const accountId = e.target.value;
    setFormData((prev) => ({
      ...prev,
      accountId,
      // if the main account becomes the coins account, clear it
      coinsAccountId:
        prev.coinsAccountId === accountId ? '' : prev.coinsAccountId,
    }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      notes: e.target.value,
    }));
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    cancelLocationDetection();
    setLocationSearchQuery(e.target.value);
    setActiveLocationSuggestion(-1);
    setLocationMetadata({});
    const clearInferredCategory =
      categorySelectionOriginRef.current === 'location';
    if (clearInferredCategory) categorySelectionOriginRef.current = null;
    setFormData((prev) => {
      return {
        ...prev,
        location: e.target.value,
        ...(clearInferredCategory ? { expenseTypeId: '' } : {}),
      };
    });
  };

  const setLocation = (label: string, metadata: PlaceCategoryMetadata = {}) => {
    const clearInferredCategory =
      formData.location !== label &&
      categorySelectionOriginRef.current === 'location';
    if (clearInferredCategory) categorySelectionOriginRef.current = null;
    setFormData((prev) => {
      return {
        ...prev,
        location: label,
        ...(clearInferredCategory ? { expenseTypeId: '' } : {}),
      };
    });
    setLocationMetadata(metadata);
    setLocationSearchQuery('');
    setLocationSuggestions([]);
    setLocationSearchStatus('idle');
    setActiveLocationSuggestion(-1);
  };

  const handleLocationSuggestionSelect = (suggestion: LocationSuggestion) => {
    cancelLocationDetection();
    setLocation(suggestion.label, {
      category: suggestion.category,
      type: suggestion.type,
    });
  };

  const handleOnlineLocationToggle = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    cancelLocationDetection();
    setLocationSearchQuery('');
    setLocation(e.target.checked ? ONLINE_LOCATION_VALUE : '');
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && locationSuggestions.length > 0) {
      e.preventDefault();
      setActiveLocationSuggestion((current) =>
        Math.min(current + 1, locationSuggestions.length - 1)
      );
    } else if (e.key === 'ArrowUp' && locationSuggestions.length > 0) {
      e.preventDefault();
      setActiveLocationSuggestion((current) => Math.max(current - 1, 0));
    } else if (
      e.key === 'Enter' &&
      activeLocationSuggestion >= 0 &&
      locationSuggestions[activeLocationSuggestion]
    ) {
      e.preventDefault();
      handleLocationSuggestionSelect(locationSuggestions[activeLocationSuggestion]);
    } else if (e.key === 'Escape' && locationSuggestionsOpen) {
      e.preventDefault();
      setLocationSearchQuery('');
      setLocationSuggestions([]);
      setLocationSearchStatus('idle');
      setActiveLocationSuggestion(-1);
    }
  };

  const cancelLocationDetection = (updateState = true) => {
    gpsRequestIdRef.current += 1;
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    reverseGeocodeControllerRef.current?.abort();
    reverseGeocodeControllerRef.current = null;
    if (updateState) setIsLocating(false);
  };

  const handleReimbursableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      reimbursable: e.target.checked,
    }));
  };

  const startLocationDetection = () => {
    cancelLocationDetection();
    setLocationSearchQuery('');
    setLocationSuggestions([]);
    setLocationSearchStatus('idle');
    if (!('geolocation' in navigator)) {
      setIsLocating(false);
      showToast('Geolocalizzazione non supportata dal dispositivo', '⚠️');
      return;
    }

    const requestId = gpsRequestIdRef.current;
    setIsLocating(true);
    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (requestId !== gpsRequestIdRef.current) return;
        if (gpsWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          gpsWatchIdRef.current = null;
        }

        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        if (
          homeLocationRef.current &&
          isWithinHomeRadius(coordinates, homeLocationRef.current)
        ) {
          setLocation(ONLINE_LOCATION_VALUE);
          setLocationSearchQuery('');
          showToast('Casa rilevata: acquisto online selezionato');
          setIsLocating(false);
          return;
        }
        const controller = new AbortController();
        reverseGeocodeControllerRef.current = controller;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}&zoom=18&accept-language=it`,
            { signal: controller.signal }
          );
          if (!response.ok) {
            throw new Error('network');
          }
          const data: unknown = await response.json();
          if (requestId !== gpsRequestIdRef.current) return;
          if (!isRecord(data)) throw new Error('Invalid reverse geocoding response');
          const placeName =
            typeof data.display_name === 'string' ? data.display_name : '';
          setLocation(placeName, {
            category:
              typeof data.category === 'string' ? data.category : undefined,
            type: typeof data.type === 'string' ? data.type : undefined,
          });
          if (placeName) {
            showToast('Luogo rilevato dalla posizione');
          } else {
            showToast('Nessun luogo trovato per la posizione', '⚠️');
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          console.error('Reverse geocoding failed:', err);
          showToast('Errore di rete nel rilevare il luogo', '⚠️');
        } finally {
          if (requestId === gpsRequestIdRef.current) {
            reverseGeocodeControllerRef.current = null;
            setIsLocating(false);
          }
        }
      },
      (error) => {
        if (requestId !== gpsRequestIdRef.current) return;
        if (gpsWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        }
        gpsWatchIdRef.current = null;
        setIsLocating(false);
        const message =
          error.code === 1
            ? 'Permesso di geolocalizzazione negato'
            : error.code === 2
              ? 'Posizione non disponibile'
              : 'Tempo scaduto nel rilevare la posizione';
        showToast(message, '⚠️');
      },
      { timeout: 12000, maximumAge: 60000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (expenseId) return;
    startLocationDetection();
    return () => cancelLocationDetection(false);
  }, [expenseId]);

  useEffect(() => {
    if (!expenseHistoryLoaded || !suggestedExpenseType) return;
    if (categorySelectionOriginRef.current === 'manual') return;
    if (formData.expenseTypeId === suggestedExpenseType.expenseTypeId) return;

    const suggestedType = expenseTypes.find(
      (type) => type.id === suggestedExpenseType.expenseTypeId
    );
    if (!suggestedType) return;

    categorySelectionOriginRef.current = 'location';
    setFormData((prev) => ({
      ...prev,
      expenseTypeId: suggestedExpenseType.expenseTypeId,
    }));
    setExpenseTypeSearch('');
    setShowTypeDropdown(false);
    showToast(`Categoria "${suggestedType.name}" individuata dal luogo`);
  }, [
    expenseHistoryLoaded,
    expenseTypes,
    formData.expenseTypeId,
    suggestedExpenseType,
  ]);

  const handleCoinsAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        coinsAmount: value,
      }));
    }
  };

  const handleCoinsAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      coinsAccountId: e.target.value,
    }));
  };

  const handleExpenseTypeSearch = (value: string) => {
    if (value.trim()) {
      const clearInferredCategory =
        categorySelectionOriginRef.current === 'location';
      categorySelectionOriginRef.current = 'manual';
      if (clearInferredCategory) {
        setFormData((prev) => ({ ...prev, expenseTypeId: '' }));
      }
    }
    setExpenseTypeSearch(value);
    setShowTypeDropdown(true);
  };

  const filteredTypes = expenseTypes.filter((type) =>
    type.name.toLowerCase().includes(expenseTypeSearch.toLowerCase())
  );

  const selectExpenseType = (typeId: string) => {
    categorySelectionOriginRef.current = 'manual';
    setFormData((prev) => ({
      ...prev,
      expenseTypeId: typeId,
    }));
    setExpenseTypeSearch('');
    setShowTypeDropdown(false);
  };

  const createNewExpenseType = async () => {
    if (!expenseTypeSearch.trim()) return;

    try {
      const newType: ExpenseType = {
        id: uuidv4(),
        name: expenseTypeSearch,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await createExpenseType(newType);
      selectExpenseType(newType.id);
      showToast(`Categoria "${newType.name}" creata`);
    } catch (err) {
      console.error('Failed to create expense type:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location.trim()) {
      showToast('Indica un luogo o seleziona “Online / nessun luogo”', '⚠️');
      return;
    }

    if (
      !formData.date ||
      !formData.amount ||
      !formData.expenseTypeId ||
      !formData.accountId
    ) {
      showToast('Compila tutti i campi obbligatori', '⚠️');
      return;
    }

    const total = parseFloat(formData.amount);
    const coinsAmount = formData.coinsAmount
      ? parseFloat(formData.coinsAmount)
      : 0;
    const coinsAccountSelected = formData.coinsAccountId !== '';
    const hasCoins = coinsAccountSelected && coinsAmount > 0;

    if (coinsAmount > 0 && !coinsAccountSelected) {
      showToast('Seleziona il conto delle monete', '⚠️');
      return;
    }
    if (coinsAccountSelected && coinsAmount <= 0) {
      showToast('Inserisci l\'importo in monete', '⚠️');
      return;
    }
    if (hasCoins && coinsAmount > total) {
      showToast('L\'importo in monete non può superare l\'importo totale', '⚠️');
      return;
    }

    try {
      setIsLoading(true);

      await saveExpenseWithCoins({
        expenseId: expenseId || undefined,
        date: new Date(formData.date),
        time: formData.time,
        amount: total,
        expenseTypeId: formData.expenseTypeId,
        accountId: formData.accountId,
        notes: formData.notes,
        location: formData.location,
        reimbursable: formData.reimbursable,
        coinsAccountId: hasCoins ? formData.coinsAccountId : null,
        coinsAmount: hasCoins ? coinsAmount : null,
      });

      navigateBack();
    } catch (err) {
      console.error('Failed to save expense:', err);
      setAlertMessage('Errore durante il salvataggio della spesa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!expenseId) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!expenseId) return;
    try {
      await deleteExpense(expenseId);
      navigateBack();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setAlertMessage('Errore durante l\'eliminazione della spesa');
    }
  };

  const titleBarActions: TitleBarAction[] = [];
  if (expenseId) {
    titleBarActions.push({
      content: <TrashIcon />,
      label: 'Elimina',
      kind: 'danger',
      iconOnly: true,
      onClick: handleDelete,
      disabled: isLoading,
    });
  }
  titleBarActions.push({
    content: <CheckIcon />,
    label: expenseId ? 'Aggiorna' : 'Crea',
    kind: 'primary',
    iconOnly: true,
    onClick: () => formRef.current?.requestSubmit(),
    disabled: isLoading,
  });

  const selectedType = expenseTypes.find((t) => t.id === formData.expenseTypeId);
  const categoryField = (
    <div className="form-group">
      <label htmlFor="expenseType">Categoria *</label>
      <div className="expense-type-container" ref={dropdownRef}>
        <input
          type="text"
          id="expenseType"
          placeholder="Cerca o scrivi una categoria..."
          value={expenseTypeSearch || selectedType?.name || ''}
          onChange={(e) => handleExpenseTypeSearch(e.target.value)}
          onFocus={() => setShowTypeDropdown(true)}
          className="form-input"
        />
        {showTypeDropdown && (
          <div className="dropdown-menu">
            {filteredTypes.length > 0 && (
              <>
                {filteredTypes.map((type) => (
                  <div
                    key={type.id}
                    className="dropdown-item"
                    onClick={() => selectExpenseType(type.id)}
                  >
                    {type.name}
                  </div>
                ))}
                <div className="dropdown-divider"></div>
              </>
            )}
            {expenseTypeSearch.trim() &&
              !filteredTypes.find((t) => t.name === expenseTypeSearch) && (
                <div
                  className="dropdown-item new-item"
                  onClick={createNewExpenseType}
                >
                  <span className="badge">nuovo</span> {expenseTypeSearch}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
  const locationField = (
    <div className="form-group">
      <label htmlFor={isOnlineLocation ? undefined : 'location'}>Luogo *</label>
      <label
        className="checkbox-label location-online-checkbox"
        htmlFor="onlineLocation"
      >
        <input
          type="checkbox"
          id="onlineLocation"
          checked={isOnlineLocation}
          onChange={handleOnlineLocationToggle}
        />
        Acquisto online / nessun luogo
      </label>
      {isOnlineLocation ? (
        <div className="location-online-selected">
          <span>{ONLINE_LOCATION_VALUE}</span>
        </div>
      ) : (
        <>
          <div className="location-autocomplete">
            <div className="location-row">
              <input
                type="text"
                id="location"
                placeholder={
                  isLocating ? 'Caricamento posizione…' : 'Es. Via Roma 1, Milano'
                }
                value={formData.location}
                onChange={handleLocationChange}
                onKeyDown={handleLocationKeyDown}
                className="form-input"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={locationSuggestionsOpen}
                aria-controls={
                  locationSearchStatus === 'results'
                    ? 'location-suggestions'
                    : undefined
                }
                aria-activedescendant={
                  activeLocationSuggestion >= 0
                    ? `location-suggestion-${activeLocationSuggestion}`
                    : undefined
                }
                required
              />
              <button
                type="button"
                className="location-button"
                onClick={startLocationDetection}
                disabled={isLocating}
                title={
                  isLocating
                    ? 'Rilevamento posizione…'
                    : 'Compila il luogo con la posizione attuale'
                }
                aria-label="Compila il luogo con la posizione attuale"
              >
                {isLocating ? <span className="locating-dot" /> : <LocateIcon />}
              </button>
            </div>
            {isLocating && (
              <div className="location-gps-status" role="status">
                <span className="locating-dot" />
                Caricamento posizione…
              </div>
            )}
            {locationSuggestionsOpen && (
              <div className="location-suggestions">
                {locationSearchStatus === 'results' ? (
                  <ul id="location-suggestions" role="listbox">
                    {locationSuggestions.map((suggestion, index) => (
                      <li key={`${suggestion.label}-${index}`} role="presentation">
                        <button
                          id={`location-suggestion-${index}`}
                          type="button"
                          role="option"
                          aria-selected={activeLocationSuggestion === index}
                          className={`location-suggestion${
                            activeLocationSuggestion === index ? ' active' : ''
                          }`}
                          onMouseEnter={() =>
                            setActiveLocationSuggestion(index)
                          }
                          onClick={() =>
                            handleLocationSuggestionSelect(suggestion)
                          }
                        >
                          {suggestion.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="location-search-status" role="status">
                    {locationSearchStatus === 'loading' && 'Ricerca luoghi…'}
                    {locationSearchStatus === 'empty' &&
                      'Nessun risultato. Puoi inserire il luogo manualmente.'}
                    {locationSearchStatus === 'error' &&
                      'Ricerca non disponibile. Puoi continuare a inserirlo manualmente.'}
                  </div>
                )}
                <div className="location-attribution">
                  Risultati da{' '}
                  <a
                    href="https://photon.komoot.io/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Photon
                  </a>
                  {' · Dati © '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenStreetMap
                  </a>
                </div>
              </div>
            )}
          </div>
          {locationSearchQuery.trim().length > 0 &&
            locationSearchQuery.trim().length < 3 && (
              <p className="location-search-hint">
                Digita almeno 3 caratteri per cercare.
              </p>
            )}
        </>
      )}
    </div>
  );

  const coinsActive =
    formData.coinsAccountId !== '' && parseFloat(formData.coinsAmount) > 0;
  const mainAccountName =
    accounts.find((a) => a.id === formData.accountId)?.name || '?';
  const coinsAccountName =
    accounts.find((a) => a.id === formData.coinsAccountId)?.name || '?';

  return (
    <div className="expense-page">
      <TitleBar
        title={expenseId ? 'Modifica spesa' : 'Nuova spesa'}
        actions={titleBarActions}
      />

      <main className="page-content">
        <form ref={formRef} className="expense-form" onSubmit={handleSubmit} noValidate>
          {locationField}
          {categoryField}

          {/* Date Field */}
          <div className="form-group">
            <label htmlFor="date">Data *</label>
            <input
              type="date"
              id="date"
              value={formData.date}
              onChange={handleDateChange}
              required
              className="form-input"
            />
          </div>

          {/* Time Field */}
          <div className="form-group">
            <label htmlFor="time">Ora (hh:mm:ss) *</label>
            <input
              type="time"
              id="time"
              step={1}
              value={formData.time}
              onChange={handleTimeChange}
              required
              className="form-input"
            />
          </div>

          {/* Amount Field */}
          <div className="form-group">
            <label htmlFor="amount">Importo (€) *</label>
            <input
              type="text"
              inputMode="decimal"
              id="amount"
              placeholder="0.00"
              value={formData.amount}
              onChange={handleAmountChange}
              required
              className="form-input"
            />
          </div>

          {/* Account Field */}
          <div className="form-group">
            <label htmlFor="account">Conto *</label>
            <select
              id="account"
              value={formData.accountId}
              onChange={handleAccountChange}
              required
              className="form-input"
            >
              {sortedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reimbursable flag: the expense will be reimbursed (e.g. with the salary) */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label" htmlFor="reimbursable">
              <input
                type="checkbox"
                id="reimbursable"
                checked={formData.reimbursable}
                onChange={handleReimbursableChange}
              />
              Sarà rimborsata
            </label>
          </div>

          {/* Additional info (optional) */}
          <div className="form-section">
            <div className="form-section-title">
              Informazioni aggiuntive (opzionale)
            </div>
            <div className="form-group">
              <label htmlFor="notes">Note</label>
              <textarea
                id="notes"
                rows={2}
                placeholder="Es. cena con amici, numero fattura…"
                value={formData.notes}
                onChange={handleNotesChange}
                className="form-textarea"
              />
            </div>
          </div>

          {/* Coin split (optional): paid partly from a second account */}
          <div className="form-section">
            <div className="form-section-title">
              Pagato in parte con monete (opzionale)
            </div>
            <div className="form-group">
              <label htmlFor="coinsAmount">Importo in monete (€)</label>
              <input
                type="text"
                inputMode="decimal"
                id="coinsAmount"
                placeholder="0.00"
                value={formData.coinsAmount}
                onChange={handleCoinsAmountChange}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="coinsAccount">Conto monete</label>
              <select
                id="coinsAccount"
                value={formData.coinsAccountId}
                onChange={handleCoinsAccountChange}
                className="form-input"
              >
                <option value="">Nessuno</option>
                {coinAccounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                    disabled={account.id === formData.accountId}
                  >
                    {account.name}
                  </option>
                ))}
                {/* keep a legacy selection even if the coin flag was removed */}
                {formData.coinsAccountId &&
                  !coinAccounts.some((a) => a.id === formData.coinsAccountId) && (
                    <option value={formData.coinsAccountId}>
                      {accounts.find((a) => a.id === formData.coinsAccountId)?.name ||
                        '?'}
                    </option>
                  )}
              </select>
              {coinAccounts.length === 0 && (
                <p className="field-hint">
                  Nessun conto monete: crealo dalla gestione Conti.
                </p>
              )}
            </div>
            {coinsActive && (
              <div className="form-info">
                <p className="info-text">
                  💡 Verranno creati 3 movimenti:
                  <br />• Spesa −{formData.amount || '0.00'}€ su{' '}
                  {mainAccountName}
                  <br />• Entrata +{formData.coinsAmount || '0.00'}€ su{' '}
                  {coinsAccountName}
                  <br />• 🔄 {coinsAccountName} → {mainAccountName}
                </p>
              </div>
            )}
          </div>

          {/* Hidden submit button to keep native form submission (e.g. Enter key) */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>
      </main>

      <Toast message={toast?.message ?? null} icon={toast?.icon} />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Elimina Spesa"
        lines="Vuoi eliminare questa spesa?"
        confirmLabel="Elimina"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <AlertModal
        open={!!alertMessage}
        message={alertMessage}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
