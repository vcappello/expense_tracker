import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import {
  HOME_LOCATION_RADIUS_METERS,
  loadHomeLocation,
  removeHomeLocation,
  saveHomeLocation,
} from '../utils/homeLocation';
import type { Coordinates } from '../utils/homeLocation';

interface HomeLocationSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface GpsPosition extends Coordinates {
  accuracy: number;
}

export default function HomeLocationSettingsModal({
  open,
  onClose,
}: HomeLocationSettingsModalProps) {
  const [homeLocation, setHomeLocation] = useState<Coordinates | null>(null);
  const [candidate, setCandidate] = useState<GpsPosition | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    try {
      setHomeLocation(loadHomeLocation());
      setError(null);
    } catch (err) {
      console.error('Failed to load home location:', err);
      setError('La posizione salvata non è valida. Puoi impostarne una nuova.');
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      requestIdRef.current += 1;
      setIsLocating(false);
      setCandidate(null);
    };
  }, [open]);

  const stopWatching = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsLocating(false);
  };

  const startGpsCapture = () => {
    setError(null);
    setCandidate(null);
    if (!('geolocation' in navigator)) {
      setError('La geolocalizzazione non è supportata da questo dispositivo.');
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLocating(true);
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (requestId !== requestIdRef.current) return;
          stopWatching();
          setCandidate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (gpsError) => {
          if (requestId !== requestIdRef.current) return;
          stopWatching();
          setError(
            gpsError.code === 1
              ? 'Permesso di geolocalizzazione negato.'
              : gpsError.code === 2
                ? 'Posizione non disponibile. Puoi riprovare.'
                : 'Tempo scaduto nel rilevare la posizione. Puoi riprovare.'
          );
        },
        { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
      );
    } catch (err) {
      console.error('Failed to start home location GPS capture:', err);
      setIsLocating(false);
      setError('Impossibile avviare il rilevamento GPS. Puoi riprovare.');
    }
  };

  const handleSave = () => {
    if (!candidate) return;
    try {
      saveHomeLocation({
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      });
      setHomeLocation({
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      });
      setCandidate(null);
      setError(null);
    } catch (err) {
      console.error('Failed to save home location:', err);
      setError('Impossibile salvare la posizione su questo dispositivo.');
    }
  };

  const handleRemove = () => {
    try {
      removeHomeLocation();
      setHomeLocation(null);
      setCandidate(null);
      setError(null);
    } catch (err) {
      console.error('Failed to remove home location:', err);
      setError('Impossibile rimuovere la posizione salvata.');
    }
  };

  return (
    <Modal
      open={open}
      title="Posizione di casa"
      onClose={onClose}
      actions={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Chiudi
        </button>
      }
    >
      <div className="home-location-settings">
        <p>
          Salva o aggiorna la posizione mentre sei a casa. Le coordinate restano
          solo su questo dispositivo; entro {HOME_LOCATION_RADIUS_METERS} metri,
          durante una nuova spesa, verrà selezionato “Online / nessun luogo”.
        </p>
        {homeLocation ? (
          <div className="home-location-status" role="status">
            Posizione di casa configurata su questo dispositivo.
          </div>
        ) : (
          <div className="home-location-status">
            Nessuna posizione di casa configurata.
          </div>
        )}
        <div className="home-location-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={startGpsCapture}
            disabled={isLocating}
          >
            {isLocating
              ? 'Rilevamento posizione…'
              : homeLocation
                ? 'Aggiorna con la posizione attuale'
                : 'Rileva la posizione di casa'}
          </button>
          {homeLocation && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRemove}
              disabled={isLocating}
            >
              Rimuovi posizione
            </button>
          )}
        </div>
        {isLocating && (
          <div className="home-location-status" role="status">
            <span className="locating-dot" />
            Attendo una posizione GPS precisa…
          </div>
        )}
        {candidate && (
          <div className="home-location-candidate">
            <p>
              Posizione rilevata con precisione di circa{' '}
              {Math.round(candidate.accuracy)} metri. Salvala solo se sei a casa.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
            >
              Salva questa posizione come casa
            </button>
          </div>
        )}
        {error && (
          <div className="home-location-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
