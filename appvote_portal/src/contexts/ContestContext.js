import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';
import supabase from '../config/supabaseClient';

/**
 * Context for managing contest weeks, active contest, and winners
 * Provides data and functions related to the contest state throughout the app
 */
const ContestContext = createContext();

// PUBLIC_INTERFACE
export function useContest() {
  return useContext(ContestContext);
}

// PUBLIC_INTERFACE
export function ContestProvider({ children }) {
  /**
   * Provider component that makes contest data available to all child components
   */
  const [contestWeeks, setContestWeeks] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [winners, setWinners] = useState({});
  const [loading, setLoading] = useState(true);
  const { isAdmin, user } = useAuth();

  // Fetch contest weeks data
  useEffect(() => {
    const fetchContestWeeks = async () => {
      try {
        const { data, error } = await supabase
          .from('contest_weeks')
          .select('*')
          .order('id', { ascending: true });

        if (error) throw error;
        setContestWeeks(data || []);

        // Find current active week if any
        const activeWeek = data?.find(week => week.status === 'active');
        if (activeWeek) {
          setCurrentWeek(activeWeek);
        } else {
          // If no active week, we'll use the first upcoming week
          // or the most recently ended week
          const upcomingWeek = data?.find(week => week.status === 'upcoming');
          const endedWeeks = data?.filter(week => week.status === 'ended' || week.status === 'completed');
          const mostRecentEndedWeek = endedWeeks?.length 
            ? endedWeeks.sort((a, b) => new Date(b.end_date) - new Date(a.end_date))[0]
            : null;

          setCurrentWeek(upcomingWeek || mostRecentEndedWeek || (data?.length ? data[0] : null));
        }
      } catch (error) {
        console.error('Error fetching contest weeks:', error.message);
        toast.error('Failed to load contest data');
      } finally {
        setLoading(false);
      }
    };

    fetchContestWeeks();
    fetchWinners();

    // Subscribe to changes in contest_weeks table
    const contestSubscription = supabase
      .channel('custom-contest-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'contest_weeks' }, 
        () => {
          fetchContestWeeks();
      })
      .subscribe();

    // Subscribe to changes in contest_winners table
    const winnersSubscription = supabase
      .channel('custom-winners-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'contest_winners' }, 
        () => {
          fetchWinners();
      })
      .subscribe();

    return () => {
      contestSubscription.unsubscribe();
      winnersSubscription.unsubscribe();
    };
  }, []);

  // Fetch contest winners for all weeks
  const fetchWinners = async () => {
    try {
      const { data, error } = await supabase
        .from('contest_winners')
        .select(`
          id,
          position,
          contest_week_id,
          app_id,
          apps:app_id (
            id,
            name,
            link,
            image_url,
            user_id,
            profiles:user_id (username, registration_number)
          )
        `)
        .order('position', { ascending: true });

      if (error) throw error;

      // Organize winners by contest week
      const winnersByWeek = {};
      data?.forEach(winner => {
        if (!winnersByWeek[winner.contest_week_id]) {
          winnersByWeek[winner.contest_week_id] = [];
        }
        winnersByWeek[winner.contest_week_id].push(winner);
      });

      setWinners(winnersByWeek);
    } catch (error) {
      console.error('Error fetching winners:', error.message);
    }
  };

  // Switch to a different contest week (for admin or display)
  const switchWeek = (weekId) => {
    const week = contestWeeks.find(w => w.id === weekId);
    if (week) {
      setCurrentWeek(week);
      return true;
    }
    return false;
  };

  // Admin function to update contest week status
  const updateContestStatus = async (weekId, status) => {
    if (!isAdmin()) {
      toast.error('Only admins can update contest status');
      return false;
    }

    try {
      // If setting a week to active, make sure no other week is active
      if (status === 'active') {
        const activeWeek = contestWeeks.find(w => w.status === 'active');
        
        // If there's already an active week and it's not the one we're updating
        if (activeWeek && activeWeek.id !== weekId) {
          const { error: deactivateError } = await supabase
            .from('contest_weeks')
            .update({ status: 'ended' })
            .eq('id', activeWeek.id);

          if (deactivateError) throw deactivateError;
        }
      }

      // Update the target week's status
      const { error } = await supabase
        .from('contest_weeks')
        .update({ 
          status,
          ...(status === 'active' ? { start_date: new Date().toISOString() } : {}),
          ...(status === 'ended' || status === 'completed' ? { end_date: new Date().toISOString() } : {})
        })
        .eq('id', weekId);

      if (error) throw error;

      // Refresh weeks data
      const { data: updatedWeeks, error: fetchError } = await supabase
        .from('contest_weeks')
        .select('*')
        .order('id', { ascending: true });

      if (fetchError) throw fetchError;
      
      setContestWeeks(updatedWeeks || []);
      
      // Update current week if it's the one being modified
      if (currentWeek?.id === weekId) {
        const updatedWeek = updatedWeeks?.find(w => w.id === weekId);
        if (updatedWeek) {
          setCurrentWeek(updatedWeek);
        }
      }

      toast.success(`Contest week ${weekId} updated to ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating contest status:', error.message);
      toast.error(error.message || 'Failed to update contest status');
      return false;
    }
  };

  // Admin function to select winners for a contest week
  const selectWinner = async (weekId, appId, position) => {
    if (!isAdmin()) {
      toast.error('Only admins can select winners');
      return false;
    }

    try {
      // Check if contest week is in ended state
      const week = contestWeeks.find(w => w.id === weekId);
      if (!week) {
        toast.error('Contest week not found');
        return false;
      }

      if (week.status !== 'ended') {
        toast.error('Winners can only be selected after a contest week has ended');
        return false;
      }

      // Check if a winner already exists for this position
      const existingWinner = Object.values(winners)
        .flat()
        .find(w => w.contest_week_id === weekId && w.position === position);

      if (existingWinner) {
        // Update existing winner
        const { error } = await supabase
          .from('contest_winners')
          .update({ app_id: appId })
          .eq('id', existingWinner.id);

        if (error) throw error;
      } else {
        // Insert new winner
        const { error } = await supabase
          .from('contest_winners')
          .insert([{ 
            contest_week_id: weekId, 
            app_id: appId, 
            position 
          }]);

        if (error) throw error;
      }

      // After selecting all winners (1st, 2nd, 3rd), mark the contest as completed
      if (position === 3) {
        // Check if all positions have winners
        const { data: winnersCount, error: countError } = await supabase
          .from('contest_winners')
          .select('id', { count: 'exact' })
          .eq('contest_week_id', weekId);

        if (countError) throw countError;
        
        if (winnersCount?.length === 3) {
          // Update contest status to completed
          const { error: updateError } = await supabase
            .from('contest_weeks')
            .update({ status: 'completed' })
            .eq('id', weekId);

          if (updateError) throw updateError;
        }
      }

      toast.success(`Winner set for position ${position} in week ${weekId}`);
      await fetchWinners(); // Refresh winners data
      return true;
    } catch (error) {
      console.error('Error selecting winner:', error.message);
      toast.error(error.message || 'Failed to select winner');
      return false;
    }
  };

  // Check if user can submit apps in the current contest week
  const canSubmitApps = () => {
    // Users can submit apps only during active contests
    return currentWeek?.status === 'active';
  };

  // Check if user can vote in the current contest week
  const canVote = () => {
    // Users can vote only during active contests
    return currentWeek?.status === 'active';
  };

  // Get winners for a specific week
  const getWinnersForWeek = (weekId) => {
    return winners[weekId] || [];
  };

  // Get list of all weeks with their status
  const getAllWeeks = () => {
    return contestWeeks;
  };

  // Get active contest week
  const getActiveWeek = () => {
    return contestWeeks.find(week => week.status === 'active') || null;
  };

  // Check if we have valid contest data structure
  const hasValidContestStructure = contestWeeks && contestWeeks.length > 0;

  const value = {
    loading,
    contestWeeks,
    currentWeek,
    winners,
    switchWeek,
    updateContestStatus,
    selectWinner,
    // Only allow submissions/votes if valid contest structure exists
    canSubmitApps: () => hasValidContestStructure && canSubmitApps(),
    canVote: () => hasValidContestStructure && canVote(),
    getWinnersForWeek,
    getAllWeeks,
    getActiveWeek,
    hasValidContestStructure,
  };

  return (
    <ContestContext.Provider value={value}>
      {children}
    </ContestContext.Provider>
  );
}
