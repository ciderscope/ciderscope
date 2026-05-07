"use client";
import React from "react";
import { FiUsers, FiSettings, FiArrowRight } from "react-icons/fi";

interface HomeScreenProps {
  onSelectParticipant: () => void;
  onSelectAdmin: () => void;
}

export const HomeScreen = ({ onSelectParticipant, onSelectAdmin }: HomeScreenProps) => (
  <div className="home-screen">
    <div className="home-hero">
      <h1 className="home-title">
        Cider<em>Scope</em>
      </h1>
      <p className="home-subtitle">Plateforme d&apos;analyse sensorielle&nbsp;— IFPC</p>
    </div>

    <div className="home-tiles">
      <button
        type="button"
        className="home-tile home-tile-participant"
        onClick={onSelectParticipant}
      >
        <span className="home-tile-icon"><FiUsers size={32} /></span>
        <span className="home-tile-body">
          <span className="home-tile-label">Participant</span>
          <span className="home-tile-desc">Rejoindre une séance et noter les échantillons</span>
        </span>
        <span className="home-tile-arrow"><FiArrowRight size={20} /></span>
      </button>

      <button
        type="button"
        className="home-tile home-tile-admin"
        onClick={onSelectAdmin}
      >
        <span className="home-tile-icon"><FiSettings size={32} /></span>
        <span className="home-tile-body">
          <span className="home-tile-label">Admin</span>
          <span className="home-tile-desc">Configurer les séances et consulter l&apos;analyse</span>
        </span>
        <span className="home-tile-arrow"><FiArrowRight size={20} /></span>
      </button>
    </div>
  </div>
);
