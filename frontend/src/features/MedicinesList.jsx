import React, { useEffect, useState } from "react";

const MedicinesList = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMedicines = async () => {
      setLoading(true);
      try {
        const response = await fetch("http://localhost:3001/api/medicines");
        if (!response.ok) throw new Error("Failed to fetch medicines");
        const data = await response.json();
        setMedicines(data);
      } catch (err) {
        console.error("Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, []);

  if (loading) return <p>Loading medicines...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="medicine-list-container">
      <h2>Medicines Available</h2>
      {medicines.length === 0 ? (
        <p>No medicines found in the database.</p>
      ) : (
        <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Brand</th>
              <th>Quantity</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => (
              <tr key={m._id}>
                <td>{m.name}</td>
                <td>{m.brand}</td>
                <td>{m.quantity}</td>
                <td>{m.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MedicinesList;
